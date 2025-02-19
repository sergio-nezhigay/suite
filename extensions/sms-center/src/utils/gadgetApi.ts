import { Client } from '@gadget-client/admin-action-block';

const isProduction = process.env.NODE_ENV === 'production';

export const gadgetApi = new Client({
  authenticationMode: { browserSession: true },
  environment: isProduction ? 'production' : 'development',
});
