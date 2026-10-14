import { deleteRecord } from "gadget-server";

/** @type { ActionRun } */
export const run = async ({ params, record, logger, api, connections }) => {
  await deleteRecord(record);
};

/** @type { import("gadget-server").ActionOptions } */
export const options = {
  actionType: "delete",
};
