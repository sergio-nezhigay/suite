import { FastifyRequest } from 'fastify';

interface QueryParams {
  query?: string;
  limit?: string;
  page?: string;
  supplierId?: string;
  categoryId?: string;
}

export function getUrlParams(request: FastifyRequest) {
  const query = request.query as QueryParams;
  return {
    query: query.query || undefined,
    limit: query.limit || undefined,
    page: query.page || undefined,
    supplierId: query.supplierId || undefined,
    categoryId: query.categoryId || undefined,
  };
}

export default getUrlParams;
