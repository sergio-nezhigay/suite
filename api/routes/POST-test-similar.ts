import { RouteHandler } from 'gadget-server';

const route: RouteHandler<{
  Body: { message: string };
}> = async ({ reply, api, connections, request }) => {
  const productId = request?.body?.message || '9708717146428';
  const data = await api.shopifyProduct.findOne(productId, {
    select: {
      title: true,
      body: true,
      vendor: true,
      specificationsType: true,
      variants: {
        edges: {
          node: {
            price: true,
            barcode: true,
          },
        },
      },
    },
  });
  const product = {
    body: data.body || '',
    title: data.title || '',
    vendor: data.vendor || '',
    barcode: data.variants.edges[0].node.barcode || '',
    price: data.variants.edges[0].node.price,
    specificationsType: data.specificationsType,
  };

  console.log('🚀 ~ product:', product);

  const title = product.title;
  const descr = product.body;
  const vendor = product.vendor;
  const barcode = product.barcode;

  const titleUpdated = title
    .toLowerCase()
    .replace(new RegExp(vendor.toLowerCase(), 'g'), '')
    .replace(new RegExp(barcode.toLowerCase(), 'g'), '');
  console.log('🚀 ~ titleUpdated:', titleUpdated);
  const descrUpdated = descr
    .toLowerCase()
    .replace(new RegExp(vendor.toLowerCase(), 'g'), '')
    .replace(new RegExp(barcode.toLowerCase(), 'g'), '');
  console.log('🚀 ~ descrUpdated:', descrUpdated);

  //  const input = descrUpdated;
  const input = title;
  //  const input = title + descr;
  //  const input = titleUpdated + descrUpdated;
  //  const input = titleUpdated;

  console.log({ message: input });

  const embeddingResponse = await connections.openai.embeddings.create({
    input: input,
    model: 'text-embedding-3-small',
  });

  const rawProducts = await api.shopifyProduct.findMany({
    sort: {
      descriptionEmbedding: {
        cosineSimilarityTo: embeddingResponse.data[0].embedding,
      },
    },
    first: 10,
    filter: {
      variants: {
        some: {
          inventoryQuantity: {
            greaterThan: 0,
          },
        },
      },
      specificationsType: {
        equals: product.specificationsType,
      },
    },
    select: {
      id: true,
      title: true,
      body: true,
      handle: true,
      shop: {
        domain: true,
      },

      images: {
        edges: {
          node: {
            alt: true,
            source: true,
          },
        },
      },
    },
  });
  const products = rawProducts.map((product) => ({
    ...product,
    images:
      product.images.edges.length > 0 ? [product.images.edges[0].node] : [],
  }));
  console.log({ products });

  await reply.send(products);
};

export default route;
