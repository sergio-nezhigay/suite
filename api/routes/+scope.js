import cors from '@fastify/cors';

export default async function (server) {
  await server.register(cors, {
    origin: [
      'https://admin.shopify.com',
      'https://extensions.shopifycdn.com',
      'http://localhost:3000',
      'https://informatica.com.ua',
    ],
  });
}
