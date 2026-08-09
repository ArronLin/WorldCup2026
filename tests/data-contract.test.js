import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const load = async (name) => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url)));

describe('published tournament data', () => {
  it('contains 104 uniquely identified matches with known teams', async () => {
    const [matches, teams] = await Promise.all([load('matches'), load('teams')]);
    expect(matches).toHaveLength(104);
    expect(new Set(matches.map((match) => match.id)).size).toBe(104);
    for (const match of matches) {
      expect(teams[match.home.code]).toBeTruthy();
      expect(teams[match.away.code]).toBeTruthy();
    }
  });

  it('keeps Chinese and English translation keys aligned', async () => {
    const readDictionary = (lang) => readFile(new URL(`../public/i18n/${lang}.json`, import.meta.url)).then(JSON.parse);
    const [zh, en] = await Promise.all([readDictionary('zh'), readDictionary('en')]);
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
});
