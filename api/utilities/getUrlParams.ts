export function getUrlParams(request: {
  url: string | URL;
  headers: { host: string };
}): Record<string, string> {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const searchParams = new URLSearchParams(url.search);

  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  return params;
}
