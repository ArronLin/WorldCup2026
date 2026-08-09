import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';

const data = async (name) => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url)));
const [matches, teams, venues, standings, bracket, awards, zh, en] = await Promise.all([
  data('matches'), data('teams'), data('venues'), data('standings'), data('bracket'), data('awards'),
  JSON.parse(await readFile(new URL('../public/i18n/zh.json', import.meta.url))),
  JSON.parse(await readFile(new URL('../public/i18n/en.json', import.meta.url))),
]);

const ajv = new Ajv({ allErrors: true });
const validMatches = ajv.compile({
  type: 'array', minItems: 104, maxItems: 104,
  items: {
    type: 'object', required: ['id', 'stage', 'date', 'home', 'away', 'homeScore', 'awayScore'],
    properties: {
      id: { type: 'integer', minimum: 1 }, stage: { type: 'string' }, date: { type: 'string' },
      homeScore: { type: 'number' }, awayScore: { type: 'number' },
      home: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
      away: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
    },
  },
});

const failures = [];
if (!validMatches(matches)) failures.push(`matches schema: ${ajv.errorsText(validMatches.errors)}`);
const ids = new Set(matches.map((match) => match.id));
if (ids.size !== matches.length) failures.push('match IDs must be unique');
const venueNames = new Set(Object.values(venues).map((venue) => {
  const name = venue.name?.en || venue.name || '';
  const city = venue.city?.en || venue.city || '';
  return city ? `${name}, ${city}` : name;
}));
const venueBaseNames = new Set(Object.values(venues).map((venue) => venue.name?.en || venue.name || ''));
for (const match of matches) {
  for (const code of [match.home.code, match.away.code]) {
    if (!teams[code]) failures.push(`match ${match.id} references missing team ${code}`);
  }
  const venueBase = String(match.stadium || '').split(',')[0];
  if (match.stadium && !venueNames.has(match.stadium) && !venueBaseNames.has(venueBase)) {
    failures.push(`match ${match.id} references missing venue ${match.stadium}`);
  }
}
for (const [group, rows] of Object.entries(standings)) {
  for (const row of rows) if (!teams[row.code]) failures.push(`standings ${group} references missing team ${row.code}`);
}
for (const key of Object.keys(zh)) if (!(key in en)) failures.push(`missing English translation for ${key}`);
for (const key of Object.keys(en)) if (!(key in zh)) failures.push(`missing Chinese translation for ${key}`);
if (!bracket || !awards) failures.push('bracket and awards must be present');

if (failures.length) {
  console.error(`Data validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Validated ${matches.length} matches, ${Object.keys(teams).length} teams, and bilingual dictionaries.`);
