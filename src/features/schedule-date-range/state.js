import { validateDateRange } from './date-range.js';

export function createScheduleDateState() {
  let draft = { start: '', end: '' };
  let applied = { start: '', end: '' };
  let errors = { start: null, end: null };
  return {
    getSnapshot: () => ({
      draft: { ...draft }, applied: { ...applied }, errors: { ...errors },
      dirty: draft.start !== applied.start || draft.end !== applied.end,
    }),
    setDraft(field, value) { draft[field] = value; },
    apply() {
      const result = validateDateRange(draft);
      if (result.ok) {
        applied = { ...result.range };
        errors = { start: null, end: null };
      } else errors = { ...result.errors };
      return result;
    },
    clear() {
      draft = { start: '', end: '' };
      applied = { ...draft };
      errors = { start: null, end: null };
    },
    discardDraft() {
      draft = { ...applied };
      errors = { start: null, end: null };
    },
  };
}
export const scheduleDateState = createScheduleDateState();
