export interface UrlParams {
  [key: string]: string | undefined;
}

export const getUrlParams = (request: { query: UrlParams }): UrlParams => {
  return { ...request.query };
};
