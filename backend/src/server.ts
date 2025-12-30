import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import fcookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors'
import fastifyRedis from '@fastify/redis';
import { fastifySchedule } from '@fastify/schedule';
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler';
import { prisma } from './db/index.js'; // Ensure correct import path
import helmet from '@fastify/helmet';

import authRoutes from './modules/auth/auth.routes.js';
import expertRoutes from './modules/expert/expert.routes.js';
import serviceRoutes from './modules/service/service.routes.js';

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// --- VALIDATE CRITICAL ENV VARS START ---
const requiredEnv = ['JWT_SECRET', 'COOKIE_SECRET', 'DATABASE_URL', 'REDIS_URL'];
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL: Missing ${key} in environment variables.`);
    process.exit(1);
  }
});

const app = Fastify({ logger: true, trustProxy: true });

await app.register(helmet);

/* ------------------------------------------------------------------
 * 2. REGISTER SECURITY & CORE PLUGINS
 * ------------------------------------------------------------------ */

// 1. Register Security Plugins
app.register(cors, {
  // Gold Standard: Restrict origin in production
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL as string]
    : true,
  credentials: true
})

// 1. REGISTER SCHEDULER (Place this with other plugins)
await app.register(fastifySchedule);

// 2. DEFINE THE CLEANUP TASK
// Gold Standard: remove unverified users after 24 hours to keep DB clean
const cleanupTask = new AsyncTask(
  'cleanup-unverified-users',
  async () => {
    app.log.info('Running cleanup for unverified users...');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { count } = await prisma.user.deleteMany({
      where: {
        emailVerifiedAt: null,
        createdAt: { lt: twentyFourHoursAgo }
      }
    });

    if (count > 0) app.log.info(`Deleted ${count} unverified users.`);
  },
  (err) => app.log.error(err)
);

// Run this job every 1 hour
const job = new SimpleIntervalJob({ hours: 1, }, cleanupTask);
app.scheduler.addSimpleIntervalJob(job);

await app.register(fastifyRedis, {
  url: process.env.REDIS_URL,
  // ensure the app crashes if redis fails to connect (fail-fast)
  closeClient: true
});

// 1. GENERATE SPECIFICATION
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Digital Offices API',
      description: 'API Documentation for the Digital Offices Platform',
      version: '1.0.0',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        // Define how we authenticate
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken'
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    // Apply security globally (Optional: can also be done per-route)
    security: [{ cookieAuth: [] }, { bearerAuth: [] }]
  }
});

// 2. EXPOSE DOCUMENTATION UI
await app.register(fastifySwaggerUi, {
  routePrefix: '/documentation', // Access docs at http://localhost:3000/documentation
  uiConfig: {
    docExpansion: 'list', // 'none' | 'list' | 'full'
    deepLinking: true
  },
  staticCSP: true, // Secure Content Security Policy
  transformStaticCSP: (header) => header
});

// JWT Authentication
app.register(fjwt, {
  secret: process.env.JWT_SECRET as string,
});

// Cookies (for refresh tokens / sessions)
app.register(fcookie, {
  secret: process.env.COOKIE_SECRET as string,
  hook: 'onRequest',
});

// Global Rate Limiting (Gold Standard)
app.register(rateLimit, {
  global: true,                 // Protect ALL routes
  max: 100,                     // 100 requests
  timeWindow: '1 minute',       // per minute
  redis: app.redis,

  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `You are sending requests too fast. Try again in ${context.after} seconds.`,
    retryAfter: context.after,
  }),
});

/* ------------------------------------------------------------------
 * 3. REGISTER ROUTES
 * ------------------------------------------------------------------ */
app.register(authRoutes, { prefix: '/api/auth' });
app.register(expertRoutes, { prefix: '/api/experts' });
app.register(serviceRoutes, { prefix: '/api/services' });

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
