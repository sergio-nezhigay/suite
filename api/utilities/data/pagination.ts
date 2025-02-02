export function getPaginatedData<T>(
  data: T[],
  limit: number,
  page: number
): T[] {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  return data.slice(startIndex, endIndex);
}
