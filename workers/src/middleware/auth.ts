import { Context, Next } from 'hono';

interface JwtHeader {
  alg: string;
  kid: string;
  typ: string;
}

interface JwtPayload {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  auth_time: number;
  [key: string]: unknown;
}

// Cache for Google public keys (6 hours)
let cachedKeys: { keys: Record<string, string>; expiresAt: number } | null = null;

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

function base64UrlDecode(str: string): Uint8Array {
  // Add padding
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtPart<T>(part: string): T {
  const decoded = new TextDecoder().decode(base64UrlDecode(part));
  return JSON.parse(decoded) as T;
}

/** Convert PEM certificate to CryptoKey */
async function pemToKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');
  const der = base64UrlDecode(
    pemContents.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  );

  // Actually we need standard base64 decode for PEM, not base64url
  const binaryStr = atob(pemContents);
  const derBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    derBytes[i] = binaryStr.charCodeAt(i);
  }

  // Import as X.509 certificate - extract public key from SPKI
  // Workers environment supports importing X.509 certs directly
  return await crypto.subtle.importKey(
    'spki',
    extractSPKIFromX509(derBytes),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/** Extract the SubjectPublicKeyInfo from an X.509 DER certificate */
function extractSPKIFromX509(cert: Uint8Array): ArrayBuffer {
  // Parse the ASN.1 DER structure to find the SubjectPublicKeyInfo
  // X.509 structure: SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
  // tbsCertificate: SEQUENCE { version, serialNumber, signature, issuer, validity, subject, subjectPublicKeyInfo, ... }
  let offset = 0;

  function readTag(): { tag: number; length: number; start: number } {
    const tag = cert[offset++];
    let length = cert[offset++];
    if (length & 0x80) {
      const numBytes = length & 0x7f;
      length = 0;
      for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | cert[offset++];
      }
    }
    return { tag, length, start: offset };
  }

  function skipField() {
    const { length } = readTag();
    offset += length;
  }

  // Outer SEQUENCE (Certificate)
  readTag();
  // tbsCertificate SEQUENCE
  readTag();

  // version [0] EXPLICIT (optional, v3)
  if (cert[offset] === 0xa0) {
    skipField();
  }

  // serialNumber
  skipField();
  // signature algorithm
  skipField();
  // issuer
  skipField();
  // validity
  skipField();
  // subject
  skipField();

  // subjectPublicKeyInfo - this is what we want
  const spkiInfo = readTag();
  return new Uint8Array(cert.buffer.slice(spkiInfo.start - (offset - spkiInfo.start), spkiInfo.start + spkiInfo.length)).buffer as ArrayBuffer;

  // Actually, let's be more precise about getting the full SPKI including its tag+length
}

/** Simplified SPKI extraction - find the public key info by parsing through the cert */
function extractSPKIFromX509V2(certDer: Uint8Array): ArrayBuffer {
  // We'll use a simpler approach: parse the DER structure step by step
  let pos = 0;

  function readLength(): number {
    let len = certDer[pos++];
    if (len & 0x80) {
      const numBytes = len & 0x7f;
      len = 0;
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | certDer[pos++];
      }
    }
    return len;
  }

  function readSequenceHeader(): number {
    if (certDer[pos] !== 0x30) throw new Error('Expected SEQUENCE');
    pos++;
    return readLength();
  }

  function skipTLV() {
    pos++; // tag
    const len = readLength();
    pos += len;
  }

  // Certificate SEQUENCE
  readSequenceHeader();
  // TBSCertificate SEQUENCE
  const tbsStart = pos;
  readSequenceHeader();

  // version [0] EXPLICIT
  if (certDer[pos] === 0xa0) {
    skipTLV();
  }
  // serialNumber INTEGER
  skipTLV();
  // signature AlgorithmIdentifier SEQUENCE
  skipTLV();
  // issuer Name SEQUENCE
  skipTLV();
  // validity SEQUENCE
  skipTLV();
  // subject Name SEQUENCE
  skipTLV();

  // subjectPublicKeyInfo SEQUENCE - capture this entire TLV
  const spkiStart = pos;
  if (certDer[pos] !== 0x30) throw new Error('Expected SEQUENCE for SPKI');
  pos++;
  const spkiContentLen = readLength();
  const spkiEnd = pos + spkiContentLen;

  return new Uint8Array(certDer.buffer.slice(spkiStart, spkiEnd)).buffer as ArrayBuffer;
}

async function fetchGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expiresAt > now) {
    return cachedKeys.keys;
  }

  const response = await fetch(GOOGLE_CERTS_URL);
  const keys = (await response.json()) as Record<string, string>;

  // Cache for 6 hours
  cachedKeys = { keys, expiresAt: now + 6 * 60 * 60 * 1000 };
  return keys;
}

async function verifyFirebaseToken(token: string, projectId: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const header = decodeJwtPart<JwtHeader>(parts[0]);
  const payload = decodeJwtPart<JwtPayload>(parts[1]);

  // Verify claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error('Token expired');
  if (payload.iat > now + 10) throw new Error('Token issued in the future');
  if (payload.aud !== projectId) throw new Error('Invalid audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error('Invalid issuer');
  if (!payload.sub || typeof payload.sub !== 'string')
    throw new Error('Invalid subject');

  // Fetch Google public keys and verify signature
  const keys = await fetchGooglePublicKeys();
  const pem = keys[header.kid];
  if (!pem) throw new Error('Unknown key ID');

  const spki = extractSPKIFromX509V2(
    new Uint8Array(
      atob(
        pem
          .replace(/-----BEGIN CERTIFICATE-----/g, '')
          .replace(/-----END CERTIFICATE-----/g, '')
          .replace(/\s/g, '')
      )
        .split('')
        .map(c => c.charCodeAt(0))
    )
  );

  const key = await crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlDecode(parts[2]);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signatureInput
  );

  if (!valid) throw new Error('Invalid signature');

  return payload;
}

// Extend Hono context to carry user ID
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const projectId = c.env.FIREBASE_PROJECT_ID as string;

  try {
    const payload = await verifyFirebaseToken(token, projectId);
    c.set('userId', payload.sub);
    await next();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Authentication failed';
    return c.json({ error: message }, 401);
  }
}
