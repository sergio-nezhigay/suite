import { openai } from '../openai';

export default async function fetchChatGPT(prompt: string) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error(`Error in fetchWithRetry for prompt "${prompt}":`, error);
    throw error;
  }
}
