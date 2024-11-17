export default async function route({ request, reply, connections }) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const searchParams = new URLSearchParams(url.search);
    const category = searchParams.get('category');
    const sid = searchParams.get('sid');
    const response = await fetch(
      `http://api.brain.com.ua/products/${category}/${sid}`
    );

    if (!response.ok) {
      return reply.status(response.status).send({
        error: 'products fetch failed',
        details: await response.text(),
      });
    }
    const data = await response.json();
    console.log('🚀 ~ data:', data);
    if (data?.status === 1 && data?.result?.list) {
      return reply.send({ list: data?.result?.list });
    } else {
      if (data.error_message === 'Session identifier is fault') {
        //get new sid
        //repeat  products fetch
        return reply.status(500).send({
          error: data.error_message,
        });
      }
    }
  } catch (error) {
    console.error('Error generating feed:', error);

    return reply
      .code(500)
      .send({ success: false, message: 'Failed to make feed' });
  }
}
