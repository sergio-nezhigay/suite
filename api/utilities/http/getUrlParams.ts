interface UrlParams {
  query?: string;
  limit?: string;
  page?: string;
  supplierId?: string;
  categoryId?: string;
}

export const getUrlParams = (request: { query: UrlParams }): UrlParams => {
  return {
    query: request.query.query,
    limit: request.query.limit,
    page: request.query.page,
    supplierId: request.query.supplierId,
    categoryId: request.query.categoryId,
  };
};
