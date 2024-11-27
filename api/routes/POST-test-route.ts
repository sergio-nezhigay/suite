import { RouteHandler } from 'gadget-server';
import fetchChatGPT from '../utilities/fetchChatGPT';
import preparePrompt from '../utilities/preparePrompt';
import parseGeneratedDescription from '../utilities/parseGeneratedDescription';

export const descr =
  'USB Type-C 100W кабель питания DC 3.0×1.1 Acer Aspire для зарядки ноутбука от повербанка USB Нужна консультация? Мы с радостью ответим на все интересующие Вас вопросы. Поможем с подбором нужного кабеля. Поддержка быстрой зарядки PD 18,5~20 В Может передавать ток 5 А, Power Delivery, ';
export const titl =
  'USB Type-C 100W кабель питания DC 3.0×1.1 Acer Aspire для зарядки ноутбука от повербанка USB';

const route: RouteHandler = async ({ reply }) => {
  try {
    const prompt = preparePrompt(titl, descr);

    const response = (await fetchChatGPT(prompt)) || '';
    const parsedResponse = parseGeneratedDescription(response);
    console.log('🚀 ~ parsedResponse:', parsedResponse);
    return { message: parsedResponse };
  } catch (error) {
    return reply.code(500).send({ error: error });
  }
};

export default route;
