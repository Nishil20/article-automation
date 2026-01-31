import { promises as fs } from 'fs';
import path from 'path';
import { Config } from '../types/index.js';
import { logger } from './logger.js';

const log = logger.child('Diversity');

// Common stop words to filter out (same set used in TrendsService)
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now',
  'and', 'but', 'or', 'because', 'until', 'while', 'this', 'that', 'these',
  'those', 'it', 'its', 'what', 'which', 'who', 'whom', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'my', 'your', 'his', 'her', 'their', 'our',
  'says', 'said', 'new', 'first', 'last', 'year', 'years', 'day', 'days',
  'time', 'week', 'month', 'get', 'make', 'go', 'know', 'take', 'see',
  'come', 'think', 'look', 'want', 'give', 'use', 'find', 'tell', 'ask',
  'work', 'seem', 'feel', 'try', 'leave', 'call', 'good', 'great', 'big',
]);

export interface RecentArticle {
  title: string;
  keywords: string[];
  createdAt: string;
}

export interface SimilarityResult {
  isTooSimilar: boolean;
  highestScore: number;
  mostSimilarTitle: string;
}

/**
 * Extract keywords from text: tokenize, lowercase, remove stop words.
 */
export function extractKeywords(text: string): string[] {
  const cleanText = text.replace(/<[^>]*>/g, '');
  const words = cleanText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
  return [...new Set(words)];
}

/**
 * Jaccard similarity between two word sets: |intersection| / |union|
 */
export function jaccardSimilarity(words1: string[], words2: string[]): number {
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Load recent article history from data/history.json, filtered by lookback window.
 */
export async function loadRecentHistory(config: Config['diversity']): Promise<RecentArticle[]> {
  try {
    const historyPath = path.join(process.cwd(), 'data', 'history.json');
    const data = await fs.readFile(historyPath, 'utf-8');
    const history: Array<Record<string, unknown>> = JSON.parse(data);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.lookbackDays);

    const recent: RecentArticle[] = [];
    for (const entry of history) {
      if (entry.status !== 'published') continue;
      const createdAt = entry.createdAt as string;
      if (new Date(createdAt) < cutoff) continue;

      recent.push({
        title: (entry.title as string) || (entry.topic as string) || '',
        keywords: Array.isArray(entry.keywords) ? entry.keywords as string[] : [],
        createdAt,
      });

      if (recent.length >= config.lookbackCount) break;
    }

    log.info(`Loaded ${recent.length} recent articles for diversity check`);
    return recent;
  } catch {
    log.debug('No history file found or failed to read, diversity check will be skipped');
    return [];
  }
}

/**
 * Check whether a candidate topic is too similar to recently published articles.
 */
export function checkTopicSimilarity(
  candidateTitle: string,
  candidateQueries: string[],
  recentHistory: RecentArticle[],
  threshold: number
): SimilarityResult {
  if (recentHistory.length === 0) {
    return { isTooSimilar: false, highestScore: 0, mostSimilarTitle: '' };
  }

  const candidateWords = [
    ...extractKeywords(candidateTitle),
    ...candidateQueries.map(q => q.toLowerCase()),
  ];

  let highestScore = 0;
  let mostSimilarTitle = '';

  for (const article of recentHistory) {
    const articleWords = [
      ...extractKeywords(article.title),
      ...article.keywords.map(k => k.toLowerCase()),
    ];

    const score = jaccardSimilarity(candidateWords, articleWords);
    if (score > highestScore) {
      highestScore = score;
      mostSimilarTitle = article.title;
    }
  }

  return {
    isTooSimilar: highestScore >= threshold,
    highestScore,
    mostSimilarTitle,
  };
}

/**
 * Format recent article titles as a string for prompt injection.
 */
export function getRecentArticleTitles(history: RecentArticle[]): string {
  if (history.length === 0) return '';
  return history.map(a => `- "${a.title}"`).join('\n');
}
