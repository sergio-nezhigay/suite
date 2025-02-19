import axios from 'axios';

const delay = (ms: number | undefined) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const run: ActionRun = async ({ api, logger }) => {
  const apiKey = process.env.NOVA_POSHTA_API_KEY || '';

  const requestPayload = {
    apiKey: apiKey,
    modelName: 'AddressGeneral',
    calledMethod: 'getWarehouses',
    methodProperties: {},
  };

  try {
    logger.info('📡 Sending request to Nova Poshta API', { requestPayload }); // Log the request payload
    const response = await axios.post(
      'https://api.novaposhta.ua/v2.0/json/',
      requestPayload
    );
    logger.info('🚀 Received response from Nova Poshta API', {
      responseData: response.data,
    });

    const data = response.data;

    if (!data.success) {
      logger.error('❌ Nova Poshta API request failed', {
        errors: data.errors || data.messageCodes,
      });
      throw new Error(
        `Error executing request: ${JSON.stringify(
          data.errors || data.messageCodes
        )}`
      );
    }

    const warehouses = data.data;
    logger.info(`📦 Found ${warehouses.length} warehouses to upsert`);

    const warehousesToUpsert = warehouses.map((warehouse: any) => ({
      id: warehouse.SiteKey || '',
      ref: warehouse.Ref || '',
      status: warehouse.WarehouseStatus || '',
      description_ru: warehouse.DescriptionRu || '',
      description: warehouse.Description || '',
      site_key: Number(warehouse.SiteKey) || 0,
    }));

    const BATCH_SIZE = 70;

    logger.info(
      `🔍 Preparing to upsert warehouses in batches of ${BATCH_SIZE}`
    );

    for (let i = 0; i < warehousesToUpsert.length && i < 1; i += BATCH_SIZE) {
      const batch = warehousesToUpsert.slice(i, i + BATCH_SIZE);
      logger.info(
        `🗂️ Enqueuing batch #${Math.floor(i / BATCH_SIZE) + 1} with ${
          batch.length
        } records`,
        { batch }
      );
      await api.enqueue(api.warehouse.bulkUpsert, batch);
      await delay(500);
    }

    logger.info('✅ Warehouses updated successfully');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Axios Error encountered', {
        message: error.message,
        responseData: error.response?.data,
      });
    } else {
      logger.error('General Error encountered', { error });
    }
    throw new Error('Error fetching from Nova Poshta: ' + error);
  }
};
