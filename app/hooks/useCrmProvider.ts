/**
 * Client-Side CRM Provider Hook
 * 
 * Provides a unified interface for calling CRM operations from React components
 * Uses fetchers under the hood to call resource routes
 * 
 * Usage:
 *   const crm = useCrmProvider(session);
 *   crm.getProducts({ q: 'wine', limit: 25 });
 */

import { useFetcher } from 'react-router';
import { useCallback, useEffect } from 'react';
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
  
  // Future methods can be added here:
  // getCustomers: (params?) => void;
  // getDiscounts: (params?) => void;
  // createDiscount: (discount) => void;
  // etc.
}

/**
 * Hook that provides CRM operations via fetchers
 * Returns methods and state for each CRM operation
 */
export function useCrmProvider(session: AppSessionData): CrmProviderMethods {
  const productsFetcher = useFetcher<{ products: any[]; error?: string }>();
  const collectionsFetcher = useFetcher<{ collections: any[]; error?: string }>();
  
  // Products methods and state
  const getProducts = useCallback((params?: { q?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    // CRITICAL: Include session ID in URL (sessions are NOT in cookies)
    searchParams.set('session', session.id);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    
    productsFetcher.load(`/api/products?${searchParams.toString()}`);
  }, [productsFetcher, session.id]);
  
  const products = productsFetcher.data?.products || null;
  const productsLoading = productsFetcher.state === 'loading';
  const productsError = productsFetcher.data?.error || null;
  
  // Collections methods and state
  const getCollections = useCallback((params?: { q?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    // CRITICAL: Include session ID in URL (sessions are NOT in cookies)
    searchParams.set('session', session.id);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    
    collectionsFetcher.load(`/api/collections?${searchParams.toString()}`);
  }, [collectionsFetcher, session.id]);
  
  const collections = collectionsFetcher.data?.collections || null;
  const collectionsLoading = collectionsFetcher.state === 'loading';
  const collectionsError = collectionsFetcher.data?.error || null;
  
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

