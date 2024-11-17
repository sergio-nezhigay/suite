import { getSid } from '../utilities/getSid';

export default async function route({ request, reply }) {
  try {
    const sid = await getSid();
    return reply.status(200).send({ sid });
  } catch (error) {
    return reply.status(500).send({
      error: error.message,
    });
  }
}
