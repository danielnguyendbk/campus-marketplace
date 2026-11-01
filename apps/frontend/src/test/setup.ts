import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill window.fetch if needed in test environment
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = vi.fn() as any;
}
