import { FastifyPluginAsync } from 'fastify';

export const threadsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /threads - List threads with pagination and search
  fastify.get('/', async (request, reply) => {
    const query = request.query as {
      workspaceId?: string;
      q?: string;
      limit?: string;
      cursor?: string;
    };

    // TODO: Implement actual data fetching from storage
    const threads = [];
    const hasMore = false;
    const nextCursor = undefined;

    return {
      threads,
      hasMore,
      nextCursor,
    };
  });

  // GET /threads/:id - Get messages for a specific thread
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as {
      cursor?: string;
      limit?: string;
    };

    // TODO: Implement actual message fetching from storage
    const messages = [];
    const hasMore = false;
    const nextCursor = undefined;

    return {
      messages,
      hasMore,
      nextCursor,
    };
  });
};
