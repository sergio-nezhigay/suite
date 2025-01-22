import { useEffect, useState } from 'react';
import { makeGraphQLQuery } from '../../shared/makeGraphQLQuery';

interface MetafieldResponse {
  location?: {
    metafield?: {
      value?: string;
    };
  };
}

function useNovaposhtaApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingApiKey, setLoadingApiKey] = useState<boolean>(false);

  useEffect(() => {
    const getNPApiKey = async () => {
      setLoadingApiKey(true);

      const metafieldQuery = `#graphql
           query LocationMetafield($namespace: String!, $key: String!, $ownerId: ID!) {
             location(id: $ownerId) {
               metafield(namespace: $namespace, key: $key) {
                 value
               }
             }
           }
         `;

      const variables = {
        namespace: 'custom',
        key: 'nova_poshta_sender_api',
        ownerId: 'gid://shopify/Location/97195786556',
      };

      try {
        const response = await makeGraphQLQuery<MetafieldResponse>(
          metafieldQuery,
          variables
        );
        const apiKeyValue = response.data?.location?.metafield?.value;
        if (apiKeyValue) {
          setApiKey(apiKeyValue);
        } else {
          throw new Error('API key not found.');
        }
      } catch (error: unknown) {
        console.error('Error fetching Nova Poshta API key:', error);
        if (error instanceof Error) {
          setError(error.message);
        }
      } finally {
        setLoadingApiKey(false);
      }
    };

    getNPApiKey();
  }, []);

  return { apiKey, error, loadingApiKey };
}

export default useNovaposhtaApiKey;
