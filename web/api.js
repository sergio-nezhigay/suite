// Sets up the API client for interacting with your backend. 
// For your API reference, visit: https://docs.gadget.dev/api/admin-action-block
import { Client } from "@gadget-client/admin-action-block";

export const api = new Client({ environment: window.gadgetConfig.environment });
