import { fetchEasy } from '../utilities/fetchEasy';
import { getUrlParams } from '../utilities/getUrlParams';

export default async function route({ request, reply, connections }) {
  try {
    const { query, limit, page } = getUrlParams(request);
    console.log('route { query, limit, page } ', { query, limit, page });
    const data = await fetchEasy({
      query,
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
