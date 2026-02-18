import { Context, Next } from 'hono';

const ALLOWED_ORIGINS = [
  'https://tofu-games.github.io',
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:5500',   // VS Code Live Server
  'http://localhost:5500',
];

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  await next();

  c.res.headers.set('Access-Control-Allow-Origin', isAllowed ? origin : ALLOWED_ORIGINS[0]);
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
