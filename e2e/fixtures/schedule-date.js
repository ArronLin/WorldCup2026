import { dateTeams, dateMatches } from '../../tests/fixtures/schedule-date.js';
export { dateTeams, dateMatches, combinationMatches, invalidDateMatches, emptyRange, deferred } from '../../tests/fixtures/schedule-date.js';

// Intercept the real data boundary while exercising the built application.
export async function installDateData(page, matches = dateMatches) {
  await page.route('**/data/teams.json', route => route.fulfill({ json: dateTeams }));
  await page.route('**/data/matches.json', route => route.fulfill({ json: matches }));
}
