import { RouteHandler } from 'fastify';
import { sendRequestNP } from '../utilities/sendRequestNP';

const route: RouteHandler<{
  Body: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  };
}> = async ({ request, reply }) => {
  const { firstName, lastName, phone, email } = request.body;

  if (!firstName || !lastName || !phone || !email) {
    return await reply.status(400).send({ error: 'All fields are required.' });
  }

  const payload = {
    modelName: 'CounterpartyGeneral',
    calledMethod: 'save',
    methodProperties: {
      FirstName: firstName,
      LastName: lastName,
      Phone: phone,
      Email: email,
      CounterpartyType: 'PrivatePerson',
      CounterpartyProperty: 'Recipient',
    },
  };

  try {
    const response = await sendRequestNP(payload);
    await reply.send({ status: 'Counterparty created successfully', response });
  } catch (error: any) {
    await reply
      .status(500)
      .send({ error: 'Failed to create counterparty', details: error.message });
  }
};

export default route;
