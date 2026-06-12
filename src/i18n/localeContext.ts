import { createContext, useContext } from 'react';
import { en, type Strings } from './en';
import { zh } from './zh';

export type Locale = 'en' | 'zh';

export const STRING_TABLES: Record<Locale, Strings> = { en, zh };

// Defaults to English so components render sensibly outside a provider (tests).
export const LocaleContext = createContext<Strings>(en);

export function useStrings(): Strings {
  return useContext(LocaleContext);
}
