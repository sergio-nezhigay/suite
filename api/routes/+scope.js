import cors from '@fastify/cors';
import { logBootOnce, startCpu, logCpu } from '../utilities/cpuTracker';

/** @param { import("gadget-server").Server } server */
export default async function (server) {
  await server.register(cors, {
    origin: [
      'https://admin.shopify.com',
      'https://extensions.shopifycdn.com',
      'http://localhost:3000',
      'https://informatica.com.ua',
    ],
  });

  // CPU per route (+ cost of a worker start on its first request). See api/utilities/cpuTracker.ts
  server.addHook('onRequest', async (request) => {
    const path = request.routeOptions?.url ?? request.url.split('?')[0];
    logBootOnce(`${request.method} ${path}`);
    /** @type {any} */ (request).cpuStart = startCpu();
  });
  server.addHook('onResponse', async (request) => {
    const start = /** @type {any} */ (request).cpuStart;
    if (!start || request.method === 'OPTIONS') return;
    const path = request.routeOptions?.url ?? request.url.split('?')[0];
    logCpu(`${request.method} ${path}`, start);
  });
}
