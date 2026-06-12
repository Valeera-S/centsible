import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/index.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './index.css';
import App from './App.tsx';
import { getDb } from './db/db';
import { seedDefaults } from './db/repo';

const db = getDb();
const root = createRoot(document.getElementById('root')!);

seedDefaults(db)
  .then(() => {
    root.render(
      <StrictMode>
        <App db={db} />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    // Without storage the app cannot work; say so instead of a blank page.
    root.render(
      <main className="app-shell">
        <h1>Centsible</h1>
        <p role="alert">
          Local storage (IndexedDB) is unavailable in this browser context, so Centsible cannot
          start. {String(error)}
        </p>
      </main>,
    );
  });
