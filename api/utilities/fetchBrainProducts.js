export async function fetchBrainProducts(category, sid, limit, page) {
  const fetchUrl = `http://api.brain.com.ua/products/${category}/${sid}?&limit=${limit}&offset=${page}`;
  const response = await fetch(fetchUrl);

  if (!response.ok) {
    throw new Error(
      `Fetch failed: ${response.status} - ${await response.text()}`
    );
  }

  return response.json();
}
