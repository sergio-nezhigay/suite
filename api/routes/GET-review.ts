import { RouteHandler } from 'gadget-server';

const route: RouteHandler = async ({ request, reply }) => {
  try {
    const { email, product_id, name, review_rating, review_body } =
      request.query as {
        email: string;
        product_id: string;
        name: string;
        review_rating: string;
        review_body: string;
      };

    const rating = parseInt(review_rating, 10);
    const body = review_body;
    const payload = {
      id: product_id,
      name,
      email,
      rating,
      body,
      shop_domain: 'informatica.com.ua',
      platform: 'shopify',
      review_type: 'product',
      verified_buyer: true,
    };
    const apiToken = process.env.JUDGEME_API_TOKEN;
    const shopDomain = 'c2da09-15.myshopify.com';
    const apiUrl = `https://judge.me/api/v1/reviews?api_token=${apiToken}&shop_domain=${shopDomain}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return reply.code(500).send({
        error: 'Failed to send review request',
        details: responseData,
      });
    }
    return reply.code(200).send({
      message: 'Ваш відгук надіслано, дякуємо!',
    });
  } catch (error) {
    let errorMessage = 'Unknown error';
    let errorStack = undefined;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    }
    return reply.code(500).send({
      error: 'Internal server error while processing review request',
    });
  }
};

export default route;
