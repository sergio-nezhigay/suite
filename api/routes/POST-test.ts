//import { RouteHandler } from 'gadget-server';

//import axios from 'axios';

//const route: RouteHandler<{
//  Body: { message: string };
//}> = async ({ reply, api, connections, request }) => {
//  const requestPayload = {
//    apiKey: apiKey,
//    modelName: 'AddressGeneral',
//    calledMethod: 'getWarehouses',
//    methodProperties: {
//      //  FindByString: '25716',
//      //  //  CityName: 'Київ',
//      //  Page: '1',
//      //  Limit: '50',
//      //  Language: 'UA',
//    },
//  };

//  try {
//    const response = await axios.post(
//      'https://api.novaposhta.ua/v2.0/json/',
//      requestPayload
//    );
//    console.log('🚀 ~ response:', response);
//    const data = response.data;

//    // Перевірка логічної відповіді
//    if (!data.success) {
//      throw new Error(
//        `Помилка під час виконання запиту: ${JSON.stringify(
//          data.errors || data.messageCodes
//        )}`
//      );
//    }

//    const departments = response.data.data;
//    console.log(departments);
//    await reply.send(departments);
//  } catch (error) {
//    if (axios.isAxiosError(error)) {
//      console.error('Axios Error:', error.message, error.response?.data);
//    } else {
//      console.error('Error:', error);
//    }
//    await reply
//      .status(500)
//      .send({ error: 'Error fetching nova pshta: ' + error });
//  }
//};

//export default route;
