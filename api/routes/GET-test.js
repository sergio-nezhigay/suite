export default async function route({ request, reply }) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const searchParams = new URLSearchParams(url.search);

  const itemId = searchParams.get('itemId');
  const category = searchParams.get('category');

  if (itemId && category) {
    await reply.send(`Item ID: ${itemId}, Category: ${category}`);
  } else {
    await reply
      .code(400)
      .send("Missing 'itemId' or 'category' search parameter");
  }
}
