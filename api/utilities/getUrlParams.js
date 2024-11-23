export function getUrlParams(request) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const searchParams = new URLSearchParams(url.search);

  const params = {};
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  return params;
}
