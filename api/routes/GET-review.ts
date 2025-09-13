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

    console.log('Received GET request from email form', {
        email,
        product_id,
        name,
        rating,
        body,
      });

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

    console.log('Judge.me API request payload', { payload });

    const apiToken = process.env.JUDGEME_API_TOKEN;
    const shopDomain = 'c2da09-15.myshopify.com';
    const apiUrl = `https://judge.me/api/v1/reviews?api_token=${apiToken}&shop_domain=${shopDomain}`;
    console.log('Judge.me API request URL', { apiUrl });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.log('Judge.me API request failed', {
          status: response.status,
          statusText: response.statusText,
          response: responseData,
          payload,
        });

      return reply.code(500).send({
        error: 'Failed to send review request',
        details: responseData,
      });
    }

    console.log('Successfully sent manual review request', {
        reviewer_email: email,
        shopify_product_id: product_id,
        response: responseData,
      });

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
    console.log('Error processing review request', {
        error: errorMessage,
        stack: errorStack,
        query: request.query,
      });

    return reply.code(500).send({
      error: 'Internal server error while processing review request',
    });
  }
};

export default route;
