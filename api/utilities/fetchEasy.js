import { parseStringPromise } from 'xml2js';

export async function fetchEasy({
  searchWord = 'кабель',
  limit = 10,
  page = 1,
}) {
  try {
    console.log(
      'Fetching...searchWord:',
      searchWord,
      'Limit:',
      limit,
      'Page:',
      page
    );

    // Fetch the raw XML data
    const response = await fetch(process.env.EASY_BUY_URL);
    const xmlText = await response.text(); // Get XML as text
    console.log('XML fetched successfully. Length of XML:', xmlText.length);

    // Parse the XML text into a JS object using xml2js
    const parsedObj = await parseStringPromise(xmlText, {
      explicitArray: false,
    });

    // Log the entire parsed object to understand its structure
    console.log(
      'XML parsed into JS object:',
      JSON.stringify(parsedObj, null, 2)
    );

    // Process the offers
    const offers = parsedObj.yml_catalog.shop.offers.offer
      .filter((offer) => {
        return (
          offer.name &&
          offer.name.toLowerCase().includes(searchWord.toLowerCase())
        );
      })
      .map((offer) => {
        return {
          name: offer.name,
          price: offer.price,
          description: offer.description,
          pictures: offer.picture,
          part_number: offer.vendorCode,
          vendor: offer.vendor,
          instock: offer.$.available === 'true' ? 5 : 0,
          warranty: 12,
          id: offer?.$?.id || `offer-${index}`,
        };
      });
    console.log('🚀 ~ offers:', offers.slice(0, 5));
    const paginatedOffers = offers.slice((page - 1) * limit, page * limit);
    return { products: paginatedOffers, count: offers.length };
  } catch (error) {
    console.error('Error fetching or processing the XML:', error);
    throw error; // Rethrow or handle as necessary
  }
}
