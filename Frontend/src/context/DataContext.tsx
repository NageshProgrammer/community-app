import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface DataContextType {
  initialData: any;
  loadingData: boolean;
  refreshAll: () => Promise<void>;
  error: string | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [initialData, setInitialData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const refreshAll = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setError(null);
    try {
      const isProd = import.meta.env.PROD;
      const fallbackUrl = isProd ? window.location.origin : 'http://localhost:10000';
      const backendBaseUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || fallbackUrl).replace(/\/$/, '');
      const url = new URL(`${backendBaseUrl}/api/bootstrap`);
      
      const currentLastFetched = localStorage.getItem('last_bootstrap_time');
      if (currentLastFetched) url.searchParams.append('since', currentLastFetched);

      const response = await fetch(url.toString(), {
        headers: { 'x-user-id': user.id }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();

      setInitialData((prev: any) => {
        if (currentLastFetched && prev) {
           return {
              ...data,
              notifications: [...data.notifications, ...prev.notifications].slice(0, 50),
              conversations: data.conversations.length > 0 ? data.conversations : prev.conversations
           };
        }
        return data;
      });

      if (data.serverTime) {
        localStorage.setItem('last_bootstrap_time', data.serverTime);
      }
    } catch (err) {
      console.error('Failed to bootstrap data:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && !initialData && !loadingData) {
      refreshAll();
    } else if (!user) {
      setInitialData(null);
      localStorage.removeItem('last_bootstrap_time');
    }
  }, [user, refreshAll, initialData, loadingData]);

  return (
    <DataContext.Provider value={{ initialData, loadingData, refreshAll, error }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
