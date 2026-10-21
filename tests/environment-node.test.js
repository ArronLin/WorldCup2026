import { it, expect } from 'vitest';
it('keeps Node as the default test environment', () => {
  expect(typeof document).toBe('undefined');
});
