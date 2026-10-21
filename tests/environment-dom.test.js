// @vitest-environment jsdom
import { it, expect } from 'vitest';
it('executes a real DOM assertion in the per-file environment', () => {
  const button = document.createElement('button');
  button.textContent = '关注球队';
  document.body.append(button);
  expect(document.querySelector('button').textContent).toBe('关注球队');
  button.remove();
});
