import React, { createContext, useContext, useState, useEffect } from 'react';

export interface RouteParams {
  path: string;
  productId?: string;
  orderId?: string;
  categoryFilter?: string;
  searchQuery?: string;
}

interface RouterContextType {
  currentPath: string;
  navigate: (to: string) => void;
  params: RouteParams;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialPath = (): string => {
    if (typeof window === 'undefined') return '/';
    // Check hash first (e.g. #/shop or #/products/prod_1)
    if (window.location.hash.startsWith('#/')) {
      return window.location.hash.slice(1);
    }
    return window.location.pathname || '/';
  };

  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.hash.startsWith('#/')
        ? window.location.hash.slice(1)
        : window.location.pathname || '/';
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigate = (to: string) => {
    // Normalise path
    let normalized = to;
    if (normalized.startsWith('#')) {
      normalized = normalized.slice(1);
    }
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    // Set hash so sandbox iframe reload or direct links work reliably
    window.location.hash = '#' + normalized;
    setCurrentPath(normalized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Parse path parameters
  const parseParams = (path: string): RouteParams => {
    const [pathname, searchStr] = path.split('?');
    const searchParams = new URLSearchParams(searchStr || '');

    const params: RouteParams = {
      path: pathname,
      categoryFilter: searchParams.get('category') || undefined,
      searchQuery: searchParams.get('q') || undefined,
    };

    if (pathname.startsWith('/products/')) {
      params.productId = pathname.replace('/products/', '');
    } else if (pathname.startsWith('/payment-status/')) {
      params.orderId = pathname.replace('/payment-status/', '');
    } else if (pathname.startsWith('/payment-failed/')) {
      params.orderId = pathname.replace('/payment-failed/', '');
    } else if (pathname.startsWith('/orders/')) {
      params.orderId = pathname.replace('/orders/', '');
    } else if (pathname.startsWith('/order/')) {
      params.orderId = pathname.replace('/order/', '');
    }

    return params;
  };

  return (
    <RouterContext.Provider
      value={{
        currentPath,
        navigate,
        params: parseParams(currentPath),
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
