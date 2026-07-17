import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { client } from '../lib/amplify';

type ModelName = 'Finances' | 'Settings';

// Amplify's generated client types each model's create/update/list signature
// individually, which doesn't unify cleanly with a runtime-selected model
// name + generic T. This narrow cast isolates that at the one boundary where
// it's unavoidable (mirrors the old hook's own `data.data as T` cast).
type GenericModelClient = {
  list: (args?: unknown) => Promise<{ data: Array<Record<string, unknown>> }>;
  create: (input: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null }>;
  update: (input: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null }>;
  delete: (input: { id: string }) => Promise<{ data: Record<string, unknown> | null }>;
};

function useAmplifyStorage<T extends object>(
  key: string,
  initialValue: T,
  modelName: ModelName
): [T, React.Dispatch<React.SetStateAction<T>>, boolean, () => Promise<void>] {
  const { user, isGuest } = useAuth();
  const model = client.models[modelName] as unknown as GenericModelClient;

  const getStorageKey = useCallback((userId?: string | null, guest?: boolean) => {
    if (guest ?? isGuest) return `guest_${key}`;
    if (userId ?? user?.userId) return `user_${userId ?? user?.userId}_${key}`;
    return key;
  }, [user?.userId, isGuest, key]);

  const readLocalStorage = useCallback((userId?: string | null, guest?: boolean): T | null => {
    try {
      const storageKey = getStorageKey(userId, guest);
      const item = window.localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }, [getStorageKey]);

  const [storedValue, setStoredValue] = useState<T>(() => readLocalStorage() ?? initialValue);
  const [loading, setLoading] = useState(!!user && !isGuest);
  const lastLoadedUserIdRef = useRef<string | null | undefined>(undefined);
  const recordIdRef = useRef<string | null>(null);

  const loadFromDatabase = useCallback(async (userId: string) => {
    try {
      const { data: records } = await model.list();
      const record = records[0];
      if (record) {
        recordIdRef.current = record.id as string;
        const { id, owner, createdAt, updatedAt, ...rest } = record;
        const value = rest as unknown as T;
        setStoredValue(value);
        window.localStorage.setItem(getStorageKey(userId, false), JSON.stringify(value));
      } else {
        recordIdRef.current = null;
      }
    } catch (error) {
      console.error(`Error loading ${modelName} from Amplify Data:`, error);
    } finally {
      setLoading(false);
    }
  }, [modelName, getStorageKey]);

  useEffect(() => {
    if (lastLoadedUserIdRef.current === user?.userId) return;
    lastLoadedUserIdRef.current = user?.userId;

    if (!user || isGuest) {
      const cached = readLocalStorage(user?.userId, isGuest);
      if (cached !== null) setStoredValue(cached);
      setLoading(false);
      return;
    }

    const cached = readLocalStorage(user.userId, false);
    if (cached !== null) {
      setStoredValue(cached);
      setLoading(false);
      loadFromDatabase(user.userId);
    } else {
      setLoading(true);
      loadFromDatabase(user.userId);
    }
  }, [user?.userId, isGuest]);

  const saveToDatabase = useCallback(async (value: T) => {
    const storageKey = getStorageKey();
    window.localStorage.setItem(storageKey, JSON.stringify(value));

    if (!user || isGuest) return;

    try {
      const valueAsRecord = value as unknown as Record<string, unknown>;
      if (recordIdRef.current) {
        await model.update({ id: recordIdRef.current, ...valueAsRecord });
      } else {
        const { data: created } = await model.create({ ...valueAsRecord });
        if (created) recordIdRef.current = created.id as string;
      }
    } catch (error) {
      console.error(`Error saving ${modelName} to Amplify Data:`, error);
    }
  }, [user?.userId, isGuest, modelName, getStorageKey]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback((value) => {
    setStoredValue(prevValue => {
      const valueToStore = value instanceof Function ? value(prevValue) : value;
      saveToDatabase(valueToStore);
      return valueToStore;
    });
  }, [saveToDatabase]);

  const deleteRemote = useCallback(async (): Promise<void> => {
    if (!user || isGuest || !recordIdRef.current) return;
    try {
      await model.delete({ id: recordIdRef.current });
      recordIdRef.current = null;
    } catch (error) {
      console.error(`Error deleting ${modelName} from Amplify Data:`, error);
    }
  }, [user?.userId, isGuest, modelName]);

  return [storedValue, setValue, loading, deleteRemote];
}

export default useAmplifyStorage;
