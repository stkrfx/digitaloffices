import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import fcookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

import authRoutes from './modules/auth/auth.routes.js';

const app = Fastify({ logger: true });

/* ------------------------------------------------------------------
 * 1. SETUP REDIS CONNECTION (for Rate Limiting)
 * ------------------------------------------------------------------ */
// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/* ------------------------------------------------------------------
 * 2. REGISTER SECURITY & CORE PLUGINS
 * ------------------------------------------------------------------ */

// JWT Authentication
app.register(fjwt, {
  secret: process.env.JWT_SECRET || 'supersecret_change_me_in_prod',
});

// Cookies (for refresh tokens / sessions)
app.register(fcookie, {
  secret: process.env.COOKIE_SECRET || 'cookie_secret_change_me',
  hook: 'onRequest',
});

// Global Rate Limiting (Gold Standard)
app.register(rateLimit, {
  global: true,                 // Protect ALL routes
  max: 100,                     // 100 requests
  timeWindow: '1 minute',       // per minute
  // redis, // ❌ COMMENT THIS LINE (uses in-memory RAM store instead)

  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `You are sending requests too fast. Try again in ${context.after} seconds.`,
  }),
});

/* ------------------------------------------------------------------
 * 3. REGISTER ROUTES
 * ------------------------------------------------------------------ */
app.register(authRoutes, { prefix: '/api/auth' });

/* ------------------------------------------------------------------
 * 4. HEALTH CHECK
 * ------------------------------------------------------------------ */
app.get('/', async () => {
  return { status: 'Mindnamo Backend Online' };
});

/* ------------------------------------------------------------------
 * 5. START SERVER
 * ------------------------------------------------------------------ */
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
