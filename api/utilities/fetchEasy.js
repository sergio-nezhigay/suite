export async function fetchEasy({ limit = 10, page = 1 }) {
  try {
    console.log('Fetching... Limit, page=', limit, page);

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
      ({ categoryId }) => categoryId === '17079773'
    );
    const result = {
      list: categoryProducts,
      count: products.length,
    };

    console.log('Products fetched and parsed:', result.count);
    return result;
  } catch (error) {
    console.error('Error fetching or parsing XML feed:', error);
    return { list: [], count: 0 }; // Return an empty result in case of error
  }
}
