import { fetchEasy } from '../utilities/fetchEasy';
import { getUrlParams } from '../utilities/getUrlParams';

export default async function route({ request, reply, connections }) {
  try {
    const { category, limit, page } = getUrlParams(request);
    const data = await fetchEasy({
      category,
      limit: +limit,
      page: +page,
    });

    return reply.send(data);
  } catch (error) {
    return reply.status(500).send({
      error: 'products fetch failed',
      details: error.message,
    });
  }
}
