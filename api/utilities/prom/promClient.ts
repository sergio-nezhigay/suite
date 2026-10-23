// Prom.ua public API. Spec: https://public-api.docs.prom.ua/
export const PROM_API = 'https://my.prom.ua/api/v1';

export class PromApiError extends Error {
  constructor(readonly status: number, readonly body: string, message: string) {
    super(message);
    this.name = 'PromApiError';
  }
}

/**
 * Call the Prom API with the seller token.
 * Prom reports some failures with HTTP 200 and an error body, so both are checked.
 */
export async function promRequest<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; json?: unknown; form?: FormData } = {}
): Promise<T> {
  const token = process.env.PROM_API_TOKEN;
  if (!token) throw new Error('PROM_API_TOKEN is not set');

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | FormData | undefined;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form; // fetch sets the multipart boundary itself
  }

  const res = await fetch(`${PROM_API}${path}`, {
    method: init.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new PromApiError(res.status, text, `Prom ${path} failed: HTTP ${res.status} ${text.slice(0, 500)}`);
  }

  const data = (text ? JSON.parse(text) : {}) as any;
  if (data?.status === 'error' || data?.error) {
    // message/error can be nested objects; keep the raw body readable in logs
    throw new PromApiError(res.status, text, `Prom ${path} failed: ${text.slice(0, 500)}`);
  }
  return data as T;
}
