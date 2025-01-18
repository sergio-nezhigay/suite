// http://api.brain.com.ua/products_pictures/categoryID/SID [?vendorID=vendorID] [&search=search] [&filterID=filterID] [&filters[]=filterID] [&limit=limit] [&offset=offset] [&sortby=field_name] [&order=order] [&lang=lang]

import { FetchingFunc } from 'api/types';
import { brainRequest } from './brainRequest';

export async function fetchBrainProductsPictures({
  query,
  limit,
  page,
}: FetchingFunc) {
  console.log('🚀 ~ fetchBrainProductsPictures:', { query, limit, page });
  const categoryID = '7936';

  const { result } = await brainRequest({
    url: `http://api.brain.com.ua/products_pictures/${categoryID}`,
    params: {
      searchString: query,
      limit,
      offset: page,
    },
  });
  console.log('🚀 ~ result:', result);

  return { result };
}
