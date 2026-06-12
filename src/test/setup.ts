import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL only auto-registers cleanup when test globals exist; we run without
// globals, so unmount rendered trees between tests explicitly.
afterEach(cleanup);
