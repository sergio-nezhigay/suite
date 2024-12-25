import { Server } from 'gadget-server';
import cors from '@fastify/cors';
/**
 * Route plugin for *
 *
 * @param { Server } server - server instance to customize, with customizations scoped to descendant paths
 *
 * @see {@link https://www.fastify.dev/docs/latest/Reference/Server}
 */
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
