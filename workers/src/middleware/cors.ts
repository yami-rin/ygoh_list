import { Context, Next } from 'hono';

const ALLOWED_ORIGINS = [
  'https://yami-rin.github.io',
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
];

function getCorsHeaders(origin: string): Record<string, string> {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin') || '';

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Process the actual request
  await next();

  // Add CORS headers to the response
  const corsHeaders = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    c.res.headers.set(key, value);
  }
}
