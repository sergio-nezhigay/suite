import cors from '@fastify/cors';

export default async function (server) {
  await server.register(cors, {
    // allow requests from any domain
    origin: true,
  });
}
