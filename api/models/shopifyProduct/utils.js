import { api, logger, connections } from "gadget-server";

export const applyTags = async (record) => {
  // get a unique list of words used in the record's description
  let newTags = [...new Set(record.body.match(/\w+(?:'\w+)*/g))];
  
  // filter down to only those words which are allowed
  const allowedTags = (await api.allowedTag.findMany()).map((tag) => tag.keyword);
  
  // merge with any existing tags and use Set to remove duplicates
  const finalTags = [
    ...new Set(
      newTags.filter((tag) => allowedTags.includes(tag)).concat(record.tags)
    )
  ];
  
  logger.info(
    { newTags, allowedTags, finalTags },
    `applying final tags to product ${record.id}`
  );
  
  // write tags back to Shopify
  const shopify = connections.shopify.current;
  if (shopify) {
    await shopify.graphql(
      `mutation ($input: ProductInput!) {
         productUpdate(input: $input) {
           product {
             tags
           }
             userErrors {
               message
           }
         }
       }`,
      {
        input: {
          id: `gid://shopify/Product/${record.id}`,
          tags: finalTags
        }
      }
    );
  }
};
