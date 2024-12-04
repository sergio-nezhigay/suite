import { getUrlParams } from '../utilities/getUrlParams';
import { fetchBrainWithRetry } from '../utilities';

export default async function route({
  request,
  record,
  reply,
  connections,
  session,
}) {
  console.log(
    '===== LOG START =====',
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  session?.set('id', 'record.sessionId');
  const id = session?.get('id');
  console.log('🚀 ~ SID:', id);

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
