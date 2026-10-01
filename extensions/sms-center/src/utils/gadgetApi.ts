import { Client } from '@gadget-client/admin-action-block';

// Replaced by the Shopify CLI bundler at build time
declare const process: { env: { NODE_ENV?: string } };

const isProduction = process.env.NODE_ENV === 'production';

export const gadgetApi = new Client({
  authenticationMode: { browserSession: true },
  environment: isProduction ? 'production' : 'development',
});
