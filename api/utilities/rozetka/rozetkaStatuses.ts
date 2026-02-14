export const ROZETKA_ORDER_STATUSES = {
  ALL: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  NEW: 4,
  SHIPPING: 5,
  PROCESSING_BY_SELLER: 26, // Context: Assigned after order is created in Shopify
  PLANNED_CALLBACK: 47, // Context: "Планується повторний дзвінок"
  RETURNED: 61, // Context: Found in commented out code, potentially "Returned" or similar
  CANCELLED: 18, // Context: "Скасування. Не вдалося зв'язатися з покупцем"
} as const;

export type RozetkaOrderStatus = typeof ROZETKA_ORDER_STATUSES[keyof typeof ROZETKA_ORDER_STATUSES];
