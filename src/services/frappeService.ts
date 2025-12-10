import { useState, useCallback, useMemo } from 'react';
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
        console.error('API Error Response:', errorJson);
        errorMessage = errorJson.message || errorJson.exc || errorJson.error || errorMessage;

        // If there's an exception trace, log it
        if (errorJson._server_messages) {
          console.error('Server Messages:', errorJson._server_messages);
        }
      } catch {
        console.error('Raw Error Text:', errorText);
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

        const url = `${siteUrl}/api/resource/${doctype}?${params.toString()}`;
        console.log('Fetching from URL:', url);
        console.log('Request options:', options);

        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

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

  const submitDoc = useCallback(
    async <T = any>(doctype: string, name: string): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        if (!siteUrl) {
          throw new Error('Site URL not configured');
        }

        const headers = await getAuthHeaders();

        // First, get the full document
        const doc = await getDoc(doctype, name);

        // Then submit it
        const response = await fetch(
          `${siteUrl}/api/method/frappe.client.submit`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              doc: JSON.stringify(doc)
            }),
          }
        );

        return await handleResponse<T>(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit document';
        setError(errorMessage);
        console.error(`Error submitting ${doctype} ${name}:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [siteUrl, getAuthHeaders, getDoc]
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

  return useMemo(
    () => ({
      loading,
      error,
      getAuthHeaders,
      getList,
      getDoc,
      createDoc,
      updateDoc,
      deleteDoc,
      submitDoc,
      call,
      callGet,
    }),
    // Note: loading and error are intentionally NOT in dependencies
    // They change frequently but shouldn't cause the service object to be recreated
    // Only the methods should trigger recreation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAuthHeaders, getList, getDoc, createDoc, updateDoc, deleteDoc, submitDoc, call, callGet]
  );
};
