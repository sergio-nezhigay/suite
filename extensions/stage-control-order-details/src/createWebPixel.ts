import { makeGraphQLQuery } from '../../shared/makeGraphQLQuery';

export async function createWebPixel(accountID: string): Promise<{
  id: string;
  settings: string;
}> {
  const mutation = `#graphql
      mutation CreateWebPixel($settings: JSON!) {
        webPixelCreate(webPixel: { settings: $settings }) {
          userErrors {
            code
            field
            message
          }
          webPixel {
            settings
            id
          }
        }
      }`;

  // Instead of using a string, we pass the accountID as part of a JSON object
  const variables = {
    settings: { accountID }, // This will be passed as a raw JSON object
  };

  const { data, errors } = await makeGraphQLQuery<{
    webPixelCreate: {
      userErrors: { code: string; field: string; message: string }[];
      webPixel: { settings: string; id: string };
    };
  }>(mutation, variables);

  // Check for any errors in the response
  if (errors || data?.webPixelCreate?.userErrors.length) {
    const errorMessages = errors
      ? errors.map((e) => e.message).join(', ')
      : data.webPixelCreate.userErrors
          .map((e) => `${e.code}: ${e.message} (Field: ${e.field})`)
          .join(', ');
    throw new Error(`Failed to create web pixel: ${errorMessages}`);
  }

  // Return the created web pixel data
  return {
    id: data.webPixelCreate.webPixel.id,
    settings: data.webPixelCreate.webPixel.settings,
  };
}

export async function getWebPixels(): Promise<
  { id: string; settings: string }[]
> {
  const query = `#graphql
    query GetWebPixels {
      webPixel {
        id
        settings
      }
    }`;

  const { data, errors } = await makeGraphQLQuery<{
    webPixel: { id: string; settings: string }[];
  }>(query, {});

  if (errors) {
    const errorMessages = errors.map((e) => e.message).join(', ');
    throw new Error(`Failed to fetch web pixels: ${errorMessages}`);
  }

  return data?.webPixel || [];
}
