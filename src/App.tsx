import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { DbProvider } from './db/DbProvider';
import type { CentsibleDb } from './db/db';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ImportPage } from './features/import/ImportPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { strings } from './i18n/strings';

interface AppProps {
  db: CentsibleDb;
}

function App({ db }: AppProps) {
  return (
    <DbProvider db={db}>
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
    </DbProvider>
  );
}

export default App;
