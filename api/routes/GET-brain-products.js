import { brainRequest } from '../utilities';

export default async function route({ request, reply }) {
  //  const category = '7926';
  //  const page = '1';
  //  const searchString = '133';
  //  const limit = '10';

  //  const fetchUrl = `http://api.brain.com.ua/products/${category}`;

  //  const test = await brainRequest(fetchUrl, {
  //    searchString,
  //    limit,
  //    offset: page,
  //  });

  return reply.send({ message: 'route test' });
}
