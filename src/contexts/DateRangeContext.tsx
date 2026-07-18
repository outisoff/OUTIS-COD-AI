import { createContext, useContext, useState, type ReactNode } from 'react';
import { subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface DateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>({ from: subDays(today, 6), to: today });

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider');
  return ctx;
}
