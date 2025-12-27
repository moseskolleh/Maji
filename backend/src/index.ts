import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { config } from './config/index.js';
import { prisma } from './config/database.js';

// Import routes
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/users.routes.js';
import { zoneRoutes } from './routes/zones.routes.js';
import { alertRoutes } from './routes/alerts.routes.js';
import { vendorRoutes } from './routes/vendors.routes.js';
import { orderRoutes, paymentRoutes } from './routes/orders.routes.js';
import { reportRoutes, resourceRoutes } from './routes/reports.routes.js';

// Create Fastify instance
const app = Fastify({
  logger: {
    level: config.env === 'development' ? 'debug' : 'info',
    transport:
      config.env === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

// Register plugins
async function registerPlugins() {
  // CORS
  await app.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'E0003',
        message: 'Too many requests, please try again later',
      },
    }),
  });

  // JWT
  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // Multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Maji API',
        description: 'Water Supply Platform for Freetown, Sierra Leone',
        version: '1.0.0',
      },
      servers: [
        {
          url: config.apiUrl,
          description: config.env === 'development' ? 'Development' : 'Production',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}

// Register routes
async function registerRoutes() {
  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // API routes
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(userRoutes, { prefix: '/v1/users' });
  await app.register(zoneRoutes, { prefix: '/v1/zones' });
  await app.register(alertRoutes, { prefix: '/v1/alerts' });
  await app.register(vendorRoutes, { prefix: '/v1/vendors' });
  await app.register(orderRoutes, { prefix: '/v1/orders' });
  await app.register(paymentRoutes, { prefix: '/v1/payments' });
  await app.register(reportRoutes, { prefix: '/v1/reports' });
  await app.register(resourceRoutes, { prefix: '/v1/resources' });
}

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);

  // Handle validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'E0001',
        message: 'Validation error',
        details: error.validation,
      },
    });
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'E0003',
        message: 'Too many requests',
      },
    });
  }

  // Handle other errors
  return reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code: 'E0002',
      message: config.env === 'development' ? error.message : 'Internal server error',
    },
  });
});

// 404 handler
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    success: false,
    error: {
      code: 'E0004',
      message: 'Route not found',
    },
  });
});

// Start server
async function start() {
  try {
    // Register plugins and routes
    await registerPlugins();
    await registerRoutes();

    // Verify database connection
    await prisma.$connect();
    app.log.info('Database connected');

    // Start listening
    await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info(`Server running at http://${config.host}:${config.port}`);
    app.log.info(`API docs available at http://${config.host}:${config.port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
});

// Run
start();

export { app };
