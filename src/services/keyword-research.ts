import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import {
  Config,
  KeywordDataProvider,
  KeywordSuggestion,
  KeywordMetrics,
  KeywordPlan,
  CannibalizationResult,
  SearchIntent,
} from '../types/index.js';
import {
  getKeywordMetricsPrompt,
  getIntentClassificationPrompt,
  getLongTailExpansionPrompt,
  getCannibalizationAnalysisPrompt,
  getNicheExpansionPrompt,
} from '../prompts/keyword-research.js';
import { GoogleAutocompleteProvider } from './providers/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child('KeywordResearch');

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CLUSTERS_FILE = path.join(DATA_DIR, 'topic-clusters.json');

const SYSTEM_PROMPT = 'You are an expert SEO keyword researcher and analyst.';

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class KeywordResearchService {
  private client: OpenAI;
  private model: string;
  private providers: KeywordDataProvider[];
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  constructor(config: Config, providers?: KeywordDataProvider[]) {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = config.openai.model;
    this.providers = providers || [new GoogleAutocompleteProvider()];
  }

  private async complete(prompt: string, temperature: number = 0.5): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature,
    });

    if (response.usage) {
      this.totalUsage.promptTokens += response.usage.prompt_tokens;
      this.totalUsage.completionTokens += response.usage.completion_tokens;
      this.totalUsage.totalTokens += response.usage.total_tokens;
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }
    return content;
  }

  private parseJSON<T>(content: string): T {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^`{3,}\s*(?:json)?\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?`{3,}\s*$/, '');
    cleaned = cleaned.replace(/^\s*`{3,}\s*$/gm, '');
    return JSON.parse(cleaned.trim()) as T;
  }

  /**
   * Expand a broad niche into specific seed topics for keyword research
   */
  async expandNicheToSeeds(niche: string): Promise<string[]> {
    log.info(`Expanding niche to seed topics: "${niche}"`);

    const prompt = getNicheExpansionPrompt(niche);
    const response = await this.complete(prompt, 0.7);
    const parsed = this.parseJSON<{ seeds: string[] }>(response);

    const seeds = parsed.seeds.slice(0, 8);
    log.info(`Generated ${seeds.length} seed topics from niche`);
    return seeds;
  }

  /**
   * Gather keyword suggestions from all providers
   */
  async researchKeywords(topic: string, relatedQueries: string[]): Promise<KeywordMetrics[]> {
    log.info(`Researching keywords for: "${topic}"`);

    // Gather suggestions from all available providers
    const allSuggestions: KeywordSuggestion[] = [];
    const seeds = [topic, ...relatedQueries.slice(0, 3)];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        log.info(`Provider "${provider.name}" not available, skipping`);
        continue;
      }

      for (const seed of seeds) {
        try {
          const suggestions = await provider.getKeywordSuggestions(seed);
          allSuggestions.push(...suggestions);
        } catch (error) {
          log.warn(`Provider "${provider.name}" failed for seed "${seed}"`, error);
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const unique = allSuggestions.filter(s => {
      const key = s.keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    log.info(`Collected ${unique.length} unique keyword suggestions`);

    // Take top candidates (limit to avoid excessive API cost)
    const candidates = unique.slice(0, 30).map(s => s.keyword);

    // GPT-4 estimates volume/difficulty/trend
    const prompt = getKeywordMetricsPrompt(candidates, topic);
    const response = await this.complete(prompt);
    const parsed = this.parseJSON<{
      metrics: Array<{
        keyword: string;
        estimatedVolume: string;
        estimatedDifficulty: number;
        trend: string;
      }>;
    }>(response);

    const validVolumes = ['high', 'medium', 'low', 'very_low'] as const;
    const validTrends = ['rising', 'stable', 'declining'] as const;

    const metrics: KeywordMetrics[] = parsed.metrics.map(m => {
      const sourceEntry = unique.find(s => s.keyword.toLowerCase() === m.keyword.toLowerCase());
      return {
        keyword: m.keyword,
        estimatedVolume: (validVolumes.includes(m.estimatedVolume as typeof validVolumes[number])
          ? m.estimatedVolume : 'low') as KeywordMetrics['estimatedVolume'],
        estimatedDifficulty: Math.min(100, Math.max(0, m.estimatedDifficulty)),
        intent: 'informational' as SearchIntent, // Will be set by classifyIntent
        trend: (validTrends.includes(m.trend as typeof validTrends[number])
          ? m.trend : 'stable') as KeywordMetrics['trend'],
        source: sourceEntry?.source || 'gpt',
      };
    });

    log.info(`Estimated metrics for ${metrics.length} keywords`);
    return metrics;
  }

  /**
   * Check if candidate keywords cannibalize existing content (single batched GPT call)
   */
  async checkCannibalization(candidates: KeywordMetrics[]): Promise<CannibalizationResult[]> {
    log.info('Checking keyword cannibalization');

    const existingArticles = this.loadExistingArticles();
    if (existingArticles.length === 0) {
      log.info('No existing articles found, skipping cannibalization check');
      return candidates.map(c => ({
        keyword: c.keyword,
        overlappingArticles: [],
        isCannibalized: false,
        suggestedLongTails: [],
      }));
    }

    // Check top candidates in a single batched call
    const topCandidates = candidates.slice(0, 10);
    const keywordStrings = topCandidates.map(c => c.keyword);

    let checkedResults: CannibalizationResult[];
    try {
      const prompt = getCannibalizationAnalysisPrompt(keywordStrings, existingArticles);
      const response = await this.complete(prompt);
      const parsed = this.parseJSON<{
        results: Array<{
          keyword: string;
          overlappingArticles: Array<{
            title: string;
            slug: string;
            similarity: number;
            matchedKeywords: string[];
          }>;
          isCannibalized: boolean;
          suggestedLongTails: string[];
        }>;
      }>(response);

      checkedResults = parsed.results.map(r => ({
        keyword: r.keyword,
        overlappingArticles: r.overlappingArticles,
        isCannibalized: r.isCannibalized,
        suggestedLongTails: r.suggestedLongTails,
      }));
    } catch (error) {
      log.warn('Batched cannibalization check failed, treating all as non-cannibalized', error);
      checkedResults = topCandidates.map(c => ({
        keyword: c.keyword,
        overlappingArticles: [],
        isCannibalized: false,
        suggestedLongTails: [],
      }));
    }

    // Add unchecked candidates as non-cannibalized
    for (const candidate of candidates.slice(10)) {
      checkedResults.push({
        keyword: candidate.keyword,
        overlappingArticles: [],
        isCannibalized: false,
        suggestedLongTails: [],
      });
    }

    const cannibalizedCount = checkedResults.filter(r => r.isCannibalized).length;
    log.info(`Cannibalization check complete: ${cannibalizedCount}/${checkedResults.length} keywords overlap`);

    return checkedResults;
  }

  /**
   * Classify search intent for keywords
   */
  async classifyIntent(keywords: KeywordMetrics[]): Promise<KeywordMetrics[]> {
    log.info(`Classifying search intent for ${keywords.length} keywords`);

    const keywordStrings = keywords.map(k => k.keyword);
    const prompt = getIntentClassificationPrompt(keywordStrings);
    const response = await this.complete(prompt);
    const parsed = this.parseJSON<{
      classifications: Array<{
        keyword: string;
        intent: string;
      }>;
    }>(response);

    const validIntents: SearchIntent[] = ['informational', 'transactional', 'navigational', 'commercial'];
    const intentMap = new Map(
      parsed.classifications.map(c => [
        c.keyword.toLowerCase(),
        validIntents.includes(c.intent as SearchIntent) ? c.intent as SearchIntent : 'informational',
      ])
    );

    return keywords.map(k => ({
      ...k,
      intent: intentMap.get(k.keyword.toLowerCase()) || 'informational',
    }));
  }

  /**
   * Expand long-tail variations for a primary keyword
   */
  async expandLongTails(primaryKeyword: string): Promise<string[]> {
    log.info(`Expanding long-tail keywords for: "${primaryKeyword}"`);

    // Get autocomplete-based long-tails
    const autocompleteLongTails: string[] = [];
    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        const suggestions = await provider.getKeywordSuggestions(primaryKeyword);
        autocompleteLongTails.push(
          ...suggestions
            .map(s => s.keyword)
            .filter(k => k.split(/\s+/).length >= 4)
        );
      } catch (error) {
        log.warn('Long-tail expansion from provider failed', error);
      }
    }

    // GPT-4 expansion
    const prompt = getLongTailExpansionPrompt(primaryKeyword, autocompleteLongTails);
    const response = await this.complete(prompt, 0.7);
    const parsed = this.parseJSON<{ longTails: string[] }>(response);

    const allLongTails = [...new Set([...autocompleteLongTails, ...parsed.longTails])];
    log.info(`Generated ${allLongTails.length} long-tail variations`);

    return allLongTails;
  }

  /**
   * Score and prioritize keywords into a plan
   */
  scoreAndPrioritize(
    candidates: KeywordMetrics[],
    cannibalization: CannibalizationResult[]
  ): KeywordPlan {
    log.info('Scoring and prioritizing keywords');

    const cannibalizationMap = new Map(
      cannibalization.map(c => [c.keyword.toLowerCase(), c])
    );

    const volumeScore: Record<string, number> = {
      high: 100,
      medium: 70,
      low: 40,
      very_low: 15,
    };

    const trendBonus: Record<string, number> = {
      rising: 100,
      stable: 60,
      declining: 20,
    };

    // Score each candidate
    const scored = candidates.map(candidate => {
      const cannResult = cannibalizationMap.get(candidate.keyword.toLowerCase());
      const isCannibalized = cannResult?.isCannibalized || false;

      const score =
        (volumeScore[candidate.estimatedVolume] || 40) * 0.3 +
        (100 - candidate.estimatedDifficulty) * 0.25 +
        70 * 0.2 + // Relevance placeholder (all from topic, so baseline relevance)
        (trendBonus[candidate.trend] || 60) * 0.15 +
        (isCannibalized ? 0 : 100) * 0.1;

      return { candidate, score, isCannibalized };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Filter non-cannibalized for primary selection
    const nonCannibalized = scored.filter(s => !s.isCannibalized);
    const primaryEntry = nonCannibalized.length > 0 ? nonCannibalized[0] : scored[0];

    // Secondary: next best non-cannibalized keywords (up to 5)
    const secondary = nonCannibalized
      .filter(s => s !== primaryEntry)
      .slice(0, 5)
      .map(s => s.candidate);

    // Determine dominant intent
    const intentCounts = new Map<SearchIntent, number>();
    for (const s of [primaryEntry.candidate, ...secondary]) {
      intentCounts.set(s.intent, (intentCounts.get(s.intent) || 0) + 1);
    }
    let dominantIntent: SearchIntent = 'informational';
    let maxCount = 0;
    for (const [intent, count] of intentCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantIntent = intent;
      }
    }

    const plan: KeywordPlan = {
      primary: primaryEntry.candidate,
      secondary,
      longTails: [],
      intentProfile: dominantIntent,
      cannibalizationReport: cannibalization,
      score: primaryEntry.score,
    };

    log.info('Keyword plan created', {
      primary: plan.primary.keyword,
      secondaryCount: plan.secondary.length,
      score: plan.score.toFixed(1),
      intentProfile: plan.intentProfile,
    });

    return plan;
  }

  /**
   * Full keyword planning pipeline
   */
  async buildKeywordPlan(topic: string, relatedQueries: string[]): Promise<KeywordPlan> {
    log.info(`Building keyword plan for: "${topic}"`);

    // 1. Research keywords from providers + GPT metrics
    const candidates = await this.researchKeywords(topic, relatedQueries);

    // 2. Check cannibalization
    let cannibalization: CannibalizationResult[];
    try {
      cannibalization = await this.checkCannibalization(candidates);
    } catch (error) {
      log.warn('Cannibalization check failed, continuing without', error);
      cannibalization = candidates.map(c => ({
        keyword: c.keyword,
        overlappingArticles: [],
        isCannibalized: false,
        suggestedLongTails: [],
      }));
    }

    // 3. Classify intent
    let classified: KeywordMetrics[];
    try {
      classified = await this.classifyIntent(candidates);
    } catch (error) {
      log.warn('Intent classification failed, defaulting to informational', error);
      classified = candidates;
    }

    // 4. Score and prioritize
    const plan = this.scoreAndPrioritize(classified, cannibalization);

    // 5. Expand long-tails for the primary keyword
    try {
      plan.longTails = await this.expandLongTails(plan.primary.keyword);
    } catch (error) {
      log.warn('Long-tail expansion failed, continuing without', error);
      plan.longTails = [];
    }

    log.info('Keyword plan complete', {
      primary: plan.primary.keyword,
      secondaryCount: plan.secondary.length,
      longTailCount: plan.longTails.length,
      score: plan.score.toFixed(1),
    });

    return plan;
  }

  /**
   * Load existing articles from history and clusters for cannibalization check
   */
  private loadExistingArticles(): Array<{ title: string; slug: string; keywords: string[] }> {
    const articles: Array<{ title: string; slug: string; keywords: string[] }> = [];

    // Load from history.json
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        const records = Array.isArray(data) ? data : (data.articles || []);
        for (const record of records) {
          if (record.title && record.slug) {
            articles.push({
              title: record.title,
              slug: record.slug,
              keywords: record.keywords || [],
            });
          }
        }
      }
    } catch (error) {
      log.warn('Failed to load history for cannibalization check', error);
    }

    // Load from topic-clusters.json
    try {
      if (fs.existsSync(CLUSTERS_FILE)) {
        const clusters = JSON.parse(fs.readFileSync(CLUSTERS_FILE, 'utf-8'));
        for (const cluster of clusters) {
          for (const article of cluster.articles || []) {
            if (article.title && article.slug) {
              const exists = articles.some(a => a.slug === article.slug);
              if (!exists) {
                articles.push({
                  title: article.title,
                  slug: article.slug,
                  keywords: article.keywords || [],
                });
              }
            }
          }
        }
      }
    } catch (error) {
      log.warn('Failed to load clusters for cannibalization check', error);
    }

    log.info(`Loaded ${articles.length} existing articles for cannibalization check`);
    return articles;
  }

  getTokenUsage(): TokenUsage {
    return { ...this.totalUsage };
  }
}
