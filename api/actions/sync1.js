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
  console.log('🚀 ~ records:', records);

  allRecords.push(...records);

  while (records.hasNextPage) {
    console.log('Pausing before fetching the next batch...');
    await new Promise((resolve) => setTimeout(resolve, pauseDuration));

    records = await records.nextPage();
    allRecords.push(...records);
  }

  console.log('All records have been processed.', allRecords.length);
};
