import { openai } from '../openai';

export default async function fetchChatGPT(prompt: string) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    console.log(
      '===== LOG START =====',
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
    console.log('response:', JSON.stringify(response, null, 4));
    return response.choices[0].message.content;
  } catch (error) {
    console.error(`Error in fetchWithRetry for prompt "${prompt}":`, error);
    throw error;
  }
}
