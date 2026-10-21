import {it,expect} from 'vitest';
import {answer} from './src/loaded.js';
it('calls the actual imported function',()=>expect(answer()).toBe(42));
