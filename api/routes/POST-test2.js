import { sendSms } from '../utilities/sendSms';

export default async function route({ request, reply, api }) {
  const allowedTagRecord = await api.allowedTag.create({
    keyword: 'example value3 for keyword',
  });
  await reply.send({ allowedTagRecord: allowedTagRecord });
}
