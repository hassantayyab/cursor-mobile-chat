import { FastifyPluginAsync } from 'fastify';

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  // WebSocket route for real-time updates
  fastify.register(async function (fastify) {
    fastify.get('/live', { websocket: true }, (connection, req) => {
      console.log('Client connected to WebSocket');

      // Send connection acknowledgment
      connection.socket.send(
        JSON.stringify({
          type: 'connection.acknowledged',
          data: { message: 'Connected successfully' },
          timestamp: Date.now(),
        })
      );

      connection.socket.on('message', message => {
        // Handle incoming messages if needed
        console.log('Received WebSocket message:', message.toString());
      });

      connection.socket.on('close', () => {
        console.log('Client disconnected from WebSocket');
      });
    });
  });
};
