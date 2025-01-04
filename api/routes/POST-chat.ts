import {
  api,
  connections,
  logger,
  RouteContext,
  RouteHandler,
} from 'gadget-server';
import { openAIResponseStream } from 'gadget-server/ai';
import { request } from 'http';

const route: RouteHandler<{
  Body: { message: string };
}> = async ({ request, reply, api, logger, connections }) => {
  const { message } = request.body;

  console.log('🚀 ~ message:', message);

  // embed the incoming message from the user
  const embeddingResponse = await connections.openai.embeddings.create({
    input: message,
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

  console.log(products);
  // capture products in Gadget's Logs
  logger.info(
    { products, message: request.body.message },
    'found products most similar to user input'
  );
  const titles = products.map(({ title }) => ({ title }));
  logger.info({ titles }, ' products names');

  const prompt = `Ви — корисний помічник для покупок, який допомагає клієнтам знайти потрібні товари. Вам буде надано питання від клієнта та кілька JSON-об'єктів із ідентифікатором, назвою, описом (body) і посиланням (handle) на товари, які приблизно відповідають запиту клієнта, а також домен магазину. Відповідайте у форматі HTML, додаючи теги <a> з картинками товарів, які ведуть на сторінки продуктів, та <br /> між текстовою відповіддю і рекомендаціями. Посилання повинно мати формат: <a href={"https://" + {domain} + "/products/" + {handle}} target="_blank">{title}<img style={border: "1px solid #3b82f6"; border-radius: 8px; border-color: 8px; display: block; margin: 0 auto;} width="200px" src={product.images.edges[0].node.source} /></a>, де {domain}, {handle} та {title} замінюються відповідними змінними. Якщо ви рекомендуєте товари, завершуйте відповідь словами "Натисніть на товар, щоб дізнатися більше!". Якщо ви не впевнені або питання здається нерелевантним, напишіть "Вибачте, я не знаю, як допомогти з цим" і додайте кілька пропозицій щодо того, які запити можна задати. Ось товари у форматі JSON, які ви можете використати для створення відповіді: ${JSON.stringify(
    products
  )}`;

  // send prompt and similar products to OpenAI to generate a response
  // using GPT-4 Turbo model
  const chatResponse = await connections.openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      { role: 'user', content: message },
    ],
    stream: true,
  });
  console.log('🚀 ~ chatResponse:', chatResponse);

  // function fired after the steam is finished
  const onComplete = async (content: string) => {
    try {
      // Log the beginning of the recommendation process
      logger.info('Starting to process recommended products...');

      const recommendedProducts = products.map((product) => ({
        create: {
          product: {
            _link: product.id,
          },
        },
      }));

      // Log the recommended products structure
      logger.info(
        { recommendedProducts },
        'Prepared recommendedProducts for chatLog creation.'
      );

      await api.chatLog.create({ response: content });

      // void api.internal.chatLog.create({
      //   response: content,
      //   recommendedProducts,
      // });

      logger.info('Successfully created chatLog with recommendedProducts.');
    } catch (error) {
      // Log any errors that occur
      logger.error(
        { error, content, products },
        'Error occurred while handling the recommendedProducts field.'
      );
    }
  };

  await reply.send(openAIResponseStream(chatResponse, { onComplete }));
};

export default route;
