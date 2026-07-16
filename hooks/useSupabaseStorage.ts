import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function useSupabaseStorage<T>(
  key: string,
  initialValue: T,
  tableName: 'user_finances' | 'user_settings'
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const { user, isGuest } = useAuth();

  const getStorageKey = useCallback((userId?: string | null, guest?: boolean) => {
    if (guest ?? isGuest) return `guest_${key}`;
    if (userId ?? user?.id) return `user_${userId ?? user?.id}_${key}`;
    return key;
  }, [user?.id, isGuest, key]);

  const readLocalStorage = useCallback((userId?: string | null, guest?: boolean): T | null => {
    try {
      const storageKey = getStorageKey(userId, guest);
      const item = window.localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }, [getStorageKey]);

  const [storedValue, setStoredValue] = useState<T>(() => {
    return readLocalStorage() ?? initialValue;
  });
  const [loading, setLoading] = useState(!!user && !isGuest);
  const lastLoadedUserIdRef = useRef<string | null | undefined>(undefined);

  const loadFromDatabase = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.data) {
        const value = data.data as T;
        setStoredValue(value);
        window.localStorage.setItem(getStorageKey(userId, false), JSON.stringify(value));
      }
    } catch (error) {
      console.error('Error loading from database:', error);
    } finally {
      setLoading(false);
    }
  }, [tableName, getStorageKey]);

  useEffect(() => {
    if (lastLoadedUserIdRef.current === user?.id) return;
    lastLoadedUserIdRef.current = user?.id;

    if (!user || isGuest) {
      const cached = readLocalStorage(user?.id, isGuest);
      if (cached !== null) setStoredValue(cached);
      setLoading(false);
      return;
    }

    const cached = readLocalStorage(user.id, false);
    if (cached !== null) {
      setStoredValue(cached);
      setLoading(false);
      loadFromDatabase(user.id);
    } else {
      setLoading(true);
      loadFromDatabase(user.id);
    }
  }, [user?.id, isGuest]);

  const saveToDatabase = useCallback(async (value: T) => {
    const storageKey = getStorageKey();
    window.localStorage.setItem(storageKey, JSON.stringify(value));

    if (!user || isGuest) return;

    try {
      const { error } = await supabase
        .from(tableName)
        .upsert({ user_id: user.id, data: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving to database:', error);
    }
  }, [user?.id, isGuest, tableName, getStorageKey]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback((value) => {
    setStoredValue(prevValue => {
      const valueToStore = value instanceof Function ? value(prevValue) : value;
      saveToDatabase(valueToStore);
      return valueToStore;
    });
  }, [saveToDatabase]);

  return [storedValue, setValue, loading];
}

export default useSupabaseStorage;
