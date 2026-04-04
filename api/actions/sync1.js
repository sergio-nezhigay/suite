export const run = async ({ api }) => {
  const allRecords = [];
  const pauseDuration = 2000;

  let records = await api.shopifyProduct.findMany({
    first: 250,
    select: {
      id: true,
      title: true,
      body: true,
    },
    filter: {
      descriptionEmbedding: { equals: null },
    },
  });
  allRecords.push(...records);

  while (records.hasNextPage) {
    await new Promise((resolve) => setTimeout(resolve, pauseDuration));

    records = await records.nextPage();
    allRecords.push(...records);
  }
};
