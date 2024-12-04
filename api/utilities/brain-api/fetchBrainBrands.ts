interface BrainBrands {
  categoryId: string;
  sid: string;
}

export default async function fetchBrainBrands({
  categoryId,
  sid,
}: BrainBrands) {
  if (!sid) {
    throw new Error(
      `Session identifier: no SID provided at fetchBrainProducts`
    );
  }

  const fetchUrl = `http://api.brain.com.ua/vendors/${categoryId}/${sid}`;

  const response = await fetch(fetchUrl);

  if (!response.ok) {
    throw new Error(
      `Fetch failed: ${response.status} - ${await response.text()}`
    );
  }
  const result = await response.json();
  return result;
}
