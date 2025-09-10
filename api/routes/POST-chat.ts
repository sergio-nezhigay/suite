import { RouteHandler } from 'gadget-server';
import { openAIResponseStream } from 'gadget-server/ai';

const route: RouteHandler<{
  Body: { message: string };
}> = async ({ request, reply, api, connections }) => {
  const { message } = request.body;

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

  console.log('[POST-chat] Info: Products found', {
    products,
    message: request.body.message,
    timestamp: new Date().toISOString(),
  });
  const titles = products.map(({ title }) => ({ title }));
  console.log('[POST-chat] Info: Product titles', {
    titles,
    timestamp: new Date().toISOString(),
  });

  const prompt = `Ви — корисний помічник для покупок, який допомагає клієнтам знайти потрібні товари. Вам буде надано питання від клієнта та кілька JSON-об'єктів із ідентифікатором, назвою, описом (body) і посиланням (handle) на товари, які приблизно відповідають запиту клієнта, а також домен магазину. Відповідайте у форматі HTML, додаючи теги <a> з картинками товарів, які ведуть на сторінки продуктів, та <br /> між текстовою відповіддю і рекомендаціями. Посилання повинно мати формат: <a href={"https://" + {domain} + "/products/" + {handle}} target="_blank">{title}<img style={border: "1px solid #3b82f6"; border-radius: 8px; border-color: 8px; display: block; margin: 0 auto;} width="200px" src={product.images.edges[0].node.source} /></a>, де {domain}, {handle} та {title} замінюються відповідними змінними. Якщо ви рекомендуєте товари, завершуйте відповідь словами "Натисніть на товар, щоб дізнатися більше!". Якщо ви не впевнені або питання здається нерелевантним, напишіть "Вибачте, я не знаю, як допомогти з цим" і додайте кілька пропозицій щодо того, які запити можна задати. Ось товари у форматі JSON, які ви можете використати для створення відповіді: ${JSON.stringify(
    products
  )}`;

  // send prompt and similar products to OpenAI to generate a response
  // using GPT-4 Turbo model
  const chatResponse = await connections.openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      { role: 'user', content: message },
    ],
    stream: true,
  });
  console.log('[POST-chat] Info: chatResponse', {
    chatResponse,
    timestamp: new Date().toISOString(),
  });

  // function fired after the steam is finished
  const onComplete = async (content: string) => {
    try {
      // Log the beginning of the recommendation process
      console.log(
        '[POST-chat] Info: Starting to process recommended products...',
        {
          timestamp: new Date().toISOString(),
        }
      );

      const recommendedProducts = products.map((product) => ({
        create: {
          product: {
            _link: product.id,
          },
        },
      }));

      // Log the recommended products structure
      console.log(
        '[POST-chat] Info: Prepared recommendedProducts for chatLog creation.',
        {
          recommendedProducts,
          timestamp: new Date().toISOString(),
        }
      );

      await api.chatLog.create({ response: content });

      // void api.internal.chatLog.create({
      //   response: content,
      //   recommendedProducts,
      // });

      console.log(
        '[POST-chat] Info: Successfully created chatLog with recommendedProducts.',
        {
          timestamp: new Date().toISOString(),
        }
      );
    } catch (error) {
      // Log any errors that occur
      console.error(
        '[POST-chat] Error: Error occurred while handling the recommendedProducts field.',
        {
          error,
          content,
          products,
          timestamp: new Date().toISOString(),
        }
      );
    }
  };

  await reply.send(openAIResponseStream(chatResponse, { onComplete }));
};

export default route;
