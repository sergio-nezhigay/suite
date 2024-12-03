export default async function fetchBrainProducts(
  category: any,
  sid: any,
  limit: any,
  page: any
) {
  const fetchUrl = `http://api.brain.com.ua/products/${category}/${sid}?&limit=${limit}&offset=${page}`;
  const response = await fetch(fetchUrl);

  if (!response.ok) {
    throw new Error(
      `Fetch failed: ${response.status} - ${await response.text()}`
    );
  }

  return response.json();
}
