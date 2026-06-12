import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DbProvider } from './db/DbProvider';
import { useDb } from './db/dbContext';
import type { CentsibleDb } from './db/db';
import { getSettings, updateSettings } from './db/repo';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ImportPage } from './features/import/ImportPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { LocaleContext, STRING_TABLES, type Locale } from './i18n/localeContext';

function AppShell() {
  const db = useDb();
  const settings = useLiveQuery(() => getSettings(db), [db]);
  const locale: Locale = settings?.locale ?? 'en';
  const strings = STRING_TABLES[locale];

  async function toggleLocale() {
    await updateSettings(db, { locale: locale === 'en' ? 'zh' : 'en' });
  }

  return (
    <LocaleContext.Provider value={strings}>
      <HashRouter>
        <div className="app-shell">
          <header className="app-header">
            <span className="app-name">{strings.appName}</span>
            <nav>
              <NavLink to="/" end>
                {strings.nav.dashboard}
              </NavLink>
              <NavLink to="/transactions">{strings.nav.transactions}</NavLink>
              <NavLink to="/import">{strings.nav.importData}</NavLink>
              <NavLink to="/settings">{strings.nav.settings}</NavLink>
              <button type="button" className="locale-toggle" onClick={toggleLocale}>
                {strings.languageToggle}
              </button>
            </nav>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <footer className="app-footer">
            {strings.appName} v{__APP_VERSION__}
          </footer>
        </div>
      </HashRouter>
    </LocaleContext.Provider>
  );
}

function App({ db }: { db: CentsibleDb }) {
  return (
    <DbProvider db={db}>
      <AppShell />
    </DbProvider>
  );
}

export default App;
