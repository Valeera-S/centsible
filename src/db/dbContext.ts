import { createContext, useContext } from 'react';
import type { CentsibleDb } from './db';

export const DbContext = createContext<CentsibleDb | null>(null);

export function useDb(): CentsibleDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside a DbProvider');
  return db;
}
