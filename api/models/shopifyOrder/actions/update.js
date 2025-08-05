import { applyParams, save, ActionOptions, UpdateShopifyOrderActionContext } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

/**
 * @param { UpdateShopifyOrderActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  console.log("update run on api/models/shopifyOrder/actions/update.js............................................");
  
  // Лог номеру замовлення
  console.log("Order Number:", record.orderNumber);
  
  // Лог статусу виконання
  console.log("Fulfillment Status:", record.fulfillmentStatus);
  
  // Для повного огляду можна вивести весь record (може бути великий)
  console.log("Full record:", record);
};
 
export const options: ActionOptions = { actionType: "update" };