import { useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';

interface FrappeListOptions {
  fields?: string[];
  filters?: Record<string, any>;
  orderBy?: string;
  limitStart?: number;
  limitPageLength?: number;
}

interface FrappeResponse<T = any> {
  message?: T;
  data?: T;
}

export const useFrappeService = () => {
  const { siteUrl } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const apiKey = await SecureStore.getItemAsync('api_key');
      const apiSecret = await SecureStore.getItemAsync('api_secret');

      if (!apiKey || !apiSecret) {
        throw new Error('Authentication credentials not found');
      }

      return {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}:${apiSecret}`,
      };
    } catch (err) {
      console.error('Error getting auth headers:', err);
      throw err;
    }
  }, []);

  const handleResponse = async <T,>(response: Response): Promise<T> => {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    const data: FrappeResponse<T> = await response.json();
    return (data.message || data.data || data) as T;
  };

  const getList = useCallback(
    async <T = any>(doctype: string, options?: FrappeListOptions): Promise<T[]> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const params = new URLSearchParams();
        params.append('doctype', doctype);

        if (options?.fields) {
          params.append('fields', JSON.stringify(options.fields));
        }

        if (options?.filters) {
          params.append('filters', JSON.stringify(options.filters));
        }

        if (options?.orderBy) {
          params.append('order_by', options.orderBy);
        }

        if (options?.limitStart !== undefined) {
          params.append('limit_start', options.limitStart.toString());
        }

        if (options?.limitPageLength !== undefined) {
          params.append('limit_page_length', options.limitPageLength.toString());
        }

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}?${params.toString()}`,
          {
            method: 'GET',
            headers,
          }
        );

        return await handleResponse<T[]>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch list';
        setError(errorMessage);
        console.error(`Error fetching ${doctype} list:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const getDoc = useCallback(
    async <T = any>(doctype: string, name: string): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}/${encodeURIComponent(name)}`,
          {
            method: 'GET',
            headers,
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch document';
        setError(errorMessage);
        console.error(`Error fetching ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const createDoc = useCallback(
    async <T = any>(doctype: string, doc: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(doc),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create document';
        setError(errorMessage);
        console.error(`Error creating ${doctype}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const updateDoc = useCallback(
    async <T = any>(doctype: string, name: string, doc: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}/${encodeURIComponent(name)}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(doc),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update document';
        setError(errorMessage);
        console.error(`Error updating ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const deleteDoc = useCallback(
    async (doctype: string, name: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/resource/${doctype}/${encodeURIComponent(name)}`,
          {
            method: 'DELETE',
            headers,
          }
        );

        await handleResponse<void>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
        setError(errorMessage);
        console.error(`Error deleting ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const call = useCallback(
    async <T = any>(method: string, params?: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const response = await fetch(
          `${siteUrl}/api/method/${method}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(params || {}),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'API call failed';
        setError(errorMessage);
        console.error(`Error calling method ${method}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  const callGet = useCallback(
    async <T = any>(method: string, params?: Record<string, any>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        const queryParams = params
          ? '?' + new URLSearchParams(
              Object.entries(params).reduce((acc, [key, value]) => {
                acc[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
                return acc;
              }, {} as Record<string, string>)
            ).toString()
          : '';

        const response = await fetch(
          `${siteUrl}/api/method/${method}${queryParams}`,
          {
            method: 'GET',
            headers,
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'API call failed';
        setError(errorMessage);
        console.error(`Error calling method ${method}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders]
  );

  return {
    loading,
    error,
    getAuthHeaders,
    getList,
    getDoc,
    createDoc,
    updateDoc,
    deleteDoc,
    call,
    callGet,
  };
};
