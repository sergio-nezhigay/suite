export function getUrlParams(request) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const searchParams = new URLSearchParams(url.search);

  return {
    category: searchParams.get('category'),
    sid: searchParams.get('sid'),
    limit: searchParams.get('limit'),
    page: searchParams.get('page'),
  };
}
