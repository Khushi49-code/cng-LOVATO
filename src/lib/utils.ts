import { Timestamp } from 'firebase/firestore';

export const calculateExpiryDate = (purchaseDate: string, warrantyMonths: number): string | null => {
  if (!purchaseDate || !warrantyMonths) return null;
  const date = new Date(purchaseDate);
  date.setMonth(date.getMonth() + parseInt(warrantyMonths.toString(), 10));
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

export const formatDate = (dateString: string | Timestamp | any): string => {
  if (!dateString) return 'N/A';
  
  if (dateString?.toDate && typeof dateString.toDate === 'function') {
    return dateString.toDate().toLocaleDateString('en-GB');
  }
  
  try {
    return new Date(dateString).toLocaleDateString('en-GB');
  } catch (error) {
    return 'Invalid Date';
  }
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
): ((...args: Parameters<F>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

export const getCachedData = <T>(key: string, maxAge: number = 30 * 60 * 1000): T | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < maxAge) {
        return parsed.data;
      }
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return null;
};

export const setCachedData = <T>(key: string, data: T, version: string = '2.0'): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
      version
    }));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

export const clearCache = (key: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
};