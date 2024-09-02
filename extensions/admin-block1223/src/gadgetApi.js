import { Client } from '@gadget-client/admin-action-block';

export const gadgetApi = new Client({
  authenticationMode: { browserSession: true },
});
