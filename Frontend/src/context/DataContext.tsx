import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface DataContextType {
  initialData: any;
  loadingData: boolean;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [initialData, setInitialData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);


  const refreshAll = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const url = new URL(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000'}/api/bootstrap`);
      // We use a ref-like approach to get the latest lastFetched without triggering dependencies
      const currentLastFetched = localStorage.getItem('last_bootstrap_time');
      if (currentLastFetched) url.searchParams.append('since', currentLastFetched);

      const response = await fetch(url.toString(), {
        headers: { 'x-user-id': user.id }
      });
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
    } finally {
      setLoadingData(false);
    }
  }, [user]); // Removed initialData and lastFetched dependencies to stop loops

  useEffect(() => {
    if (user && !initialData) {
      refreshAll();
    } else if (!user) {
      setInitialData(null);
      localStorage.removeItem('last_bootstrap_time');
    }
  }, [user, refreshAll, initialData]);

  return (
    <DataContext.Provider value={{ initialData, loadingData, refreshAll }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
