port default async function route({ request, reply, api }) {

  await reply.code(200).send({ result: "ok" });
}