import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: [
    'https://yami-rin.github.io',
    'http://localhost:3000',
    'http://localhost:8787',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
});
