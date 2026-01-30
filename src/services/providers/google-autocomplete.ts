import axios from 'axios';
import { KeywordDataProvider, KeywordSuggestion } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('GoogleAutocomplete');

const AUTOCOMPLETE_URL = 'https://suggestqueries.google.com/complete/search';
const BATCH_DELAY_MS = 200;

const MODIFIERS = [
  '',
  'how to ',
  'best ',
  'vs ',
  'for ',
  'what is ',
];

export class GoogleAutocompleteProvider implements KeywordDataProvider {
  name = 'google_autocomplete';

  isAvailable(): boolean {
    return true; // No API key required
  }

  async getKeywordSuggestions(seed: string): Promise<KeywordSuggestion[]> {
    log.info(`Fetching autocomplete suggestions for: "${seed}"`);
    const suggestions: KeywordSuggestion[] = [];
    const seen = new Set<string>();

    // Build queries with modifiers
    const queries = MODIFIERS.map(mod => mod + seed);

    // Process in batches of 3 to avoid rate limits
    for (let i = 0; i < queries.length; i += 3) {
      const batch = queries.slice(i, i + 3);
      const results = await Promise.all(
        batch.map(q => this.fetchSuggestions(q))
      );

      for (const result of results) {
        for (const keyword of result) {
          const normalized = keyword.toLowerCase().trim();
          if (!seen.has(normalized) && normalized !== seed.toLowerCase()) {
            seen.add(normalized);
            suggestions.push({
              keyword: normalized,
              source: this.name,
            });
          }
        }
      }

      // Rate limit safety between batches
      if (i + 3 < queries.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    log.info(`Found ${suggestions.length} unique suggestions for "${seed}"`);
    return suggestions;
  }

  private async fetchSuggestions(query: string): Promise<string[]> {
    try {
      const response = await axios.get(AUTOCOMPLETE_URL, {
        params: {
          client: 'firefox',
          q: query,
        },
        timeout: 5000,
      });

      // Response format: [query, [suggestion1, suggestion2, ...]]
      if (Array.isArray(response.data) && Array.isArray(response.data[1])) {
        return response.data[1] as string[];
      }
      return [];
    } catch (error) {
      log.warn(`Autocomplete request failed for "${query}"`, error);
      return [];
    }
  }
}
