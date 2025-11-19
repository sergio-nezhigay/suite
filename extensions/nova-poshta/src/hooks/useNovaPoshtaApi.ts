import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import {
  NovaPoshtaCity,
  NovaPoshtaWarehouse,
  NovaPoshtaApiResponse,
  UseCitySearchResult,
  UseWarehouseSearchResult,
  UseCreateDeclarationResult,
  CreateDeclarationParams,
  Declaration,
} from '../types';
import { SHOPIFY_APP_URL } from '../../../shared/data';

/**
 * Make a request to Nova Poshta API via our backend
 */
async function makeNovaPoshtaRequest<T = any>(payload: {
  modelName: string;
  calledMethod: string;
  methodProperties: Record<string, any>;
}): Promise<NovaPoshtaApiResponse<T>> {
  const response = await fetch(`${SHOPIFY_APP_URL}/nova-poshta/general`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to make Nova Poshta request');
  }

  return response.json();
}

/**
 * Hook: Search for cities with debouncing
 *
 * @param searchQuery - City name to search for
 * @param minLength - Minimum query length before searching (default: 2)
 * @returns City search results with loading/error states
 *
 * @example
 * const { cities, isLoading, error } = useCitySearch(searchQuery);
 */
export function useCitySearch(
  searchQuery: string,
  minLength: number = 2
): UseCitySearchResult {
  const [cities, setCities] = useState<NovaPoshtaCity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(searchQuery, 500);

  useEffect(() => {
    // Reset state if query is too short
    if (!debouncedQuery || debouncedQuery.trim().length < minLength) {
      setCities([]);
      setError(null);
      return;
    }

    let isCancelled = false;

    const fetchCities = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await makeNovaPoshtaRequest<NovaPoshtaCity>({
          modelName: 'Address',
          calledMethod: 'getCities',
          methodProperties: {
            FindByString: debouncedQuery.trim(),
          },
        });

        if (!isCancelled) {
          if (response.success && response.data) {
            setCities(response.data);
          } else {
            setCities([]);
            setError('Міста не знайдено');
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to fetch cities:', err);
          setError(err instanceof Error ? err.message : 'Помилка завантаження міст');
          setCities([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchCities();

    // Cleanup function to cancel request if component unmounts or query changes
    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, minLength]);

  return { cities, isLoading, error };
}

/**
 * Hook: Fetch warehouses for selected city with debouncing
 *
 * @param cityRef - UUID of the selected city
 * @returns Warehouse list with loading/error states
 *
 * @example
 * const { warehouses, isLoading, error } = useWarehouseSearch(selectedCityRef);
 */
export function useWarehouseSearch(
  cityRef: string | null
): UseWarehouseSearchResult {
  const [warehouses, setWarehouses] = useState<NovaPoshtaWarehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce cityRef changes to avoid rapid API calls when user clicks through cities quickly
  const debouncedCityRef = useDebounce(cityRef, 500);

  useEffect(() => {
    if (!debouncedCityRef) {
      setWarehouses([]);
      setError(null);
      return;
    }

    let isCancelled = false;

    const fetchWarehouses = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await makeNovaPoshtaRequest<NovaPoshtaWarehouse>({
          modelName: 'AddressGeneral',
          calledMethod: 'getWarehouses',
          methodProperties: {
            CityRef: debouncedCityRef,
          },
        });

        if (!isCancelled) {
          if (response.success && response.data) {
            setWarehouses(response.data);
          } else {
            setWarehouses([]);
            setError('Відділення не знайдено');
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to fetch warehouses:', err);
          setError(err instanceof Error ? err.message : 'Помилка завантаження відділень');
          setWarehouses([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchWarehouses();

    return () => {
      isCancelled = true;
    };
  }, [debouncedCityRef]);

  return { warehouses, isLoading, error };
}

/**
 * Hook: Create Nova Poshta declaration
 *
 * @returns Function to create declaration, loading state, and error
 *
 * @example
 * const { createDeclaration, isLoading, error } = useCreateDeclaration();
 * const declaration = await createDeclaration({ firstName, lastName, ... });
 */
export function useCreateDeclaration(): UseCreateDeclarationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDeclaration = useCallback(
    async (params: CreateDeclarationParams): Promise<Declaration | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${SHOPIFY_APP_URL}/nova-poshta/create-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Не вдалося створити декларацію');
        }

        setIsLoading(false);
        return result.data as Declaration;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Помилка створення декларації';
        console.error('Failed to create declaration:', err);
        setError(errorMessage);
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  return { createDeclaration, isLoading, error };
}
