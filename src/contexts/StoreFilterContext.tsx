import { createContext, useContext, useState, type ReactNode } from 'react';

interface StoreFilterContextType {
  selectedStoreId: string | null; // null = all stores
  setSelectedStoreId: (id: string | null) => void;
}

const StoreFilterContext = createContext<StoreFilterContextType | undefined>(undefined);

export function StoreFilterProvider({ children }: { children: ReactNode }) {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  return (
    <StoreFilterContext.Provider value={{ selectedStoreId, setSelectedStoreId }}>
      {children}
    </StoreFilterContext.Provider>
  );
}

export function useStoreFilter() {
  const ctx = useContext(StoreFilterContext);
  if (!ctx) throw new Error('useStoreFilter must be used within StoreFilterProvider');
  return ctx;
}
