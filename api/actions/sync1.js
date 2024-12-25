export const run = async ({ api }) => {
  const allRecords = [];
  const pauseDuration = 2000; // Pause duration in milliseconds (adjust as needed)

  // Initial fetch with the maximum allowed batch size
  let records = await api.shopifyProduct.findMany({
    first: 250, // Maximize the number of records fetched per request
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

  //  console.log(`Fetched a total of ${allRecords.length} records.`);

  //  for (const product of allRecords) {
  //    if (product.title && product.body && !product.descriptionEmbedding) {
  //      console.log('🚀 ~ Enqueuing:', product.title);
  //      await api.enqueue(api.shopifyProduct.createEmbedding, {
  //        id: product.id,
  //      });

  //      console.log('Pausing after enqueuing...');
  //      await new Promise((resolve) => setTimeout(resolve, pauseDuration));
  //    }
  //  }

  console.log('All records have been processed.', allRecords.length);
};
