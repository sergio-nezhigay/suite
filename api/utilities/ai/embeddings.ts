export const createEmbedding = async (
  connections: any,
  input: string
): Promise<any> => {
  const { data } = await connections.openai.embeddings.create({
    input,
    model: 'text-embedding-3-small',
  });
  return data[0].embedding;
};
