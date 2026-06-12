import type { ReactNode } from 'react';
import { DbContext } from './dbContext';
import type { CentsibleDb } from './db';

export function DbProvider({ db, children }: { db: CentsibleDb; children: ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}
