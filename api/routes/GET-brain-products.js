import { getUrlParams } from '../utilities/getUrlParams';
import { fetchBrainWithRetry } from '../utilities/fetchBrainWithRetry';

export default async function route({ request, reply, connections }) {
  try {
    const { category, sid, limit, page } = getUrlParams(request);
    const data = await fetchBrainWithRetry({ category, sid, limit, page });

    return reply.send({ list: data.result });
  } catch (error) {
    return reply.status(500).send({
      error: 'products fetch failed',
      details: error.message,
    });
  }
}
