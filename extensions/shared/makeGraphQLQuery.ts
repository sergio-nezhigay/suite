type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

// fetch() has no timeout of its own: a stalled request would hang the UI forever.
// Races the request against a timer (the admin's patched fetch may ignore `signal`).
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
  label: string = url
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timeout: ${label} after ${ms / 1000}s`));
    }, ms);
  });
  try {
    return await Promise.race([
      fetch(url, { ...init, signal: controller.signal }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function makeGraphQLQuery<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  const graphQLQuery = { query, variables };

  const res = await fetchWithTimeout(
    'shopify:admin/api/graphql.json',
    {
      method: 'POST',
      body: JSON.stringify(graphQLQuery),
      headers: {
        'Content-Type': 'application/json',
      },
    },
    20000,
    'Shopify GraphQL'
  );

  if (!res.ok) {
    throw new Error('Network error');
  }

  return (await res.json()) as GraphQLResponse<T>;
}
