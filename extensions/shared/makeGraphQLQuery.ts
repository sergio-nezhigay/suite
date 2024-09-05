type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function makeGraphQLQuery<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  const graphQLQuery = { query, variables };

  const res = await fetch("shopify:admin/api/graphql.json", {
    method: "POST",
    body: JSON.stringify(graphQLQuery),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Network error");
  }

  return (await res.json()) as GraphQLResponse<T>;
}
