import { Client } from '@gadget-client/admin-action-block';
export const api = new Client({
  authenticationMode: { browserSession: true },
});
