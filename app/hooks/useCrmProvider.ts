/**
 * Client-Side CRM Provider Hook
 *
 * Provides a unified interface for calling CRM operations from React components
 * Uses fetch() with headers that work behind ngrok (avoids "Failed to fetch")
 *
 * Usage:
 *   const crm = useCrmProvider(session);
 *   crm.getProducts({ q: 'wine', limit: 25 });
 */

import { useCallback, useState } from 'react';
import type { AppSessionData } from '~/lib/session-storage.server';

export interface CrmProviderMethods {
  // Products
  getProducts: (params?: { q?: string; limit?: number }) => void;
  products: any[] | null;
  productsLoading: boolean;
  productsError: string | null;

  // Collections
  getCollections: (params?: { q?: string; limit?: number }) => void;
  collections: any[] | null;
  collectionsLoading: boolean;
  collectionsError: string | null;
}

/** Headers for API requests - bypasses ngrok browser warning when app is served via ngrok */
const apiRequestHeaders: HeadersInit = {
  Accept: 'application/json',
  'Ngrok-Skip-Browser-Warning': 'true',
};

function buildApiUrl(path: string, sessionId: string, params?: { q?: string; limit?: number }): string {
  const searchParams = new URLSearchParams();
  searchParams.set('session', sessionId);
  if (params?.q) searchParams.set('q', params.q);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  return `${path}?${searchParams.toString()}`;
}

/**
 * Hook that provides CRM operations via fetch (avoids fetcher + ngrok "Failed to fetch")
 */
export function useCrmProvider(session: AppSessionData): CrmProviderMethods {
  const [products, setProducts] = useState<any[] | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [collections, setCollections] = useState<any[] | null>(null);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);

  const getProducts = useCallback(
    async (params?: { q?: string; limit?: number }) => {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const url = buildApiUrl('/api/products', session.id, params);
        const res = await fetch(url, { headers: apiRequestHeaders });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setProductsError(data?.error || `Request failed (${res.status})`);
          setProducts([]);
          return;
        }
        setProducts(Array.isArray(data?.products) ? data.products : data?.products ?? []);
        if (data?.error) setProductsError(data.error);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch products';
        setProductsError(message);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    },
    [session.id]
  );

  const getCollections = useCallback(
    async (params?: { q?: string; limit?: number }) => {
      setCollectionsLoading(true);
      setCollectionsError(null);
      try {
        const url = buildApiUrl('/api/collections', session.id, params);
        const res = await fetch(url, { headers: apiRequestHeaders });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCollectionsError(data?.error || `Request failed (${res.status})`);
          setCollections([]);
          return;
        }
        setCollections(Array.isArray(data?.collections) ? data.collections : data?.collections ?? []);
        if (data?.error) setCollectionsError(data.error);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch collections';
        setCollectionsError(message);
        setCollections([]);
      } finally {
        setCollectionsLoading(false);
      }
    },
    [session.id]
  );

  return {
    getProducts,
    products,
    productsLoading,
    productsError,
    getCollections,
    collections,
    collectionsLoading,
    collectionsError,
  };
}
