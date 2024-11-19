export async function fetchEasy({ category, limit = 10, page = 1 }) {
  try {
    console.log('Fetching...categoryid, Limit, page=', category, limit, page);

    const response = await fetch(process.env.EASY_BUY_URL);
    const xmlText = await response.text(); // Get XML as text
    console.log('XML fetched successfully.');

    // Initialize array to hold products
    let products = [];

    // Extract all product offers from the XML using regular expressions
    const offerRegex =
      /<offer id="([^"]+)"[^>]*>.*?<name>(.*?)<\/name>.*?<vendorCode>(.*?)<\/vendorCode>.*?<delivery>(.*?)<\/delivery>.*?<description>(.*?)<\/description>.*?<categoryId>(.*?)<\/categoryId>.*?<picture>(.*?)<\/picture>/gs;

    console.log('🚀 ~ offerRegex:', offerRegex);
    let match;
    while ((match = offerRegex.exec(xmlText)) !== null) {
      const [
        _,
        id,
        name,
        vendorCode,
        delivery,
        description,
        categoryId,
        picture,
      ] = match;

      const product = {
        id,
        name,
        vendorCode,
        delivery: delivery === 'true',
        description,
        categoryId,
        pictures: [picture],
      };

      products.push(product);
    }
    const categoryProducts = products.filter(
      ({ categoryId }) => categoryId === category
    );

    const startIndex = (page - 1) * limit;
    console.log('🚀 ~ page:', page);
    console.log('🚀 ~ startIndex:', startIndex);
    const endIndex = startIndex + limit;
    console.log('🚀 ~ limit:', limit);
    console.log('🚀 ~ endIndex:', endIndex);
    const paginatedProducts = categoryProducts.slice(startIndex, endIndex);

    console.log(
      `Fetched ${paginatedProducts.length} products (Page ${page}, Limit ${limit})`
    );
    const result = {
      list: paginatedProducts,
      count: categoryProducts.length,
    };

    console.log('Products fetched and parsed:', result.count);
    return result;
  } catch (error) {
    console.error('Error fetching or parsing XML feed:', error);
    return { list: [], count: 0 }; // Return an empty result in case of error
  }
}
