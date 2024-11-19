import { fetchEasy } from '../utilities/fetchEasy';
import { getUrlParams } from '../utilities/getUrlParams';

export default async function route({ request, reply, connections }) {
  try {
    const { category, sid, limit, page } = getUrlParams(request);
    const data = await fetchEasy({ limit, page });
    console.log('🚀 ~ data:', data);

    return reply.send(data);
  } catch (error) {
    return reply.status(500).send({
      error: 'products fetch failed',
      details: error.message,
    });
  }
}
