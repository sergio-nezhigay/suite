import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({
  params,
  record,
  logger,
  api,
  connections,
}) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({
  params,
  record,
  logger,
  api,
  connections,
}) => {
  try {
    // get an embedding for the product title + description using the OpenAI connection
    const response = await connections.openai.embeddings.create({
      input: `${record.title}: ${record.body}`,
      model: "text-embedding-3-small",
    });
    const embedding = response.data[0].embedding;

    // write to the Gadget Logs
    console.log("got product embedding", { id: record.id });

    // use the internal API to store vector embedding in Gadget database, on shopifyProduct model
    await api.internal.shopifyProduct.update(record.id, {
      shopifyProduct: { descriptionEmbedding: embedding },
    });
  } catch (error) {
    console.error("error creating embedding", { error });
  }
};

export const options: ActionOptions = {
  actionType: "update",
  triggers: {
    api: true,
  },
};