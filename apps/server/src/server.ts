import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Fastify, { FastifyInstance } from 'fastify';

import { actionsRoutes } from './routes/actions.js';
import { healthRoutes } from './routes/health.js';
import { threadsRoutes } from './routes/threads.js';
import { websocketRoutes } from './routes/websocket.js';

export const createServer = async (): Promise<FastifyInstance> => {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // CORS
  await server.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // WebSocket support
  await server.register(websocket);

  // Swagger documentation
  await server.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Cursor Mobile Chat API',
        description: 'API for managing Cursor chat threads and messages',
        version: '0.1.0',
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
    },
  });

  await server.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
  });

  // Authentication middleware
  server.addHook('preHandler', async (request, reply) => {
    // Skip auth for health checks and docs
    if (request.routerPath === '/healthz' || request.routerPath?.startsWith('/docs')) {
      return;
    }

    const authToken = process.env.AUTH_TOKEN;
    if (!authToken) {
      server.log.warn('No AUTH_TOKEN set in environment variables');
      return;
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      reply.code(401).send({ error: 'Missing authorization header' });
      return;
    }

    const token = authorization.replace('Bearer ', '');
    if (token !== authToken) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
  });

  // Register routes
  await server.register(healthRoutes);
  await server.register(threadsRoutes, { prefix: '/threads' });
  await server.register(actionsRoutes, { prefix: '/actions' });
  await server.register(websocketRoutes);

  return server;
};
