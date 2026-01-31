#!/usr/bin/env node

/**
 * Standalone CLI for keyword research optimized for easy-to-rank opportunities.
 *
 * Usage:
 *   npm run keyword-plan -- "your niche"
 *   KEYWORD_NICHE="your niche" npm run keyword-plan
 */

import fs from 'fs';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { KeywordResearchService } from './services/keyword-research.js';
import { Config, KeywordMetrics, CannibalizationResult, SearchIntent } from './types/index.js';
import { logger } from './utils/logger.js';

dotenvConfig();

const log = logger.child('KeywordPlanner');

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'keyword-plans.json');

// ---------------------------------------------------------------------------
// Easy-to-rank scoring
// ---------------------------------------------------------------------------

interface ScoredKeyword {
  rank: number;
  keyword: string;
  easyToRankScore: number;
  estimatedVolume: string;
  estimatedDifficulty: number;
  trend: string;
  intent: SearchIntent;
  source: string;
  isCannibalized: boolean;
  suggestedLongTails: string[];
}

function scoreForEasyRank(
  candidates: KeywordMetrics[],
  cannibalization: CannibalizationResult[],
): ScoredKeyword[] {
  const cannMap = new Map(
    cannibalization.map(c => [c.keyword.toLowerCase(), c]),
  );

  const volumeScore: Record<string, number> = {
    high: 100,
    medium: 70,
    low: 40,
    very_low: 15,
  };

  const trendScore: Record<string, number> = {
    rising: 100,
    stable: 50,
    declining: 10,
  };

  const scored = candidates.map(c => {
    const cannResult = cannMap.get(c.keyword.toLowerCase());
    const isCannibalized = cannResult?.isCannibalized ?? false;

    const intentBonus =
      c.intent === 'informational' || c.intent === 'commercial' ? 100 : 50;

    const score =
      (100 - c.estimatedDifficulty) * 0.40 +
      (volumeScore[c.estimatedVolume] ?? 40) * 0.20 +
      (trendScore[c.trend] ?? 50) * 0.20 +
      (isCannibalized ? 0 : 100) * 0.15 +
      intentBonus * 0.05;

    return {
      rank: 0, // assigned after sorting
      keyword: c.keyword,
      easyToRankScore: Math.round(score * 10) / 10,
      estimatedVolume: c.estimatedVolume,
      estimatedDifficulty: c.estimatedDifficulty,
      trend: c.trend,
      intent: c.intent,
      source: c.source,
      isCannibalized,
      suggestedLongTails: cannResult?.suggestedLongTails ?? [],
    };
  });

  scored.sort((a, b) => b.easyToRankScore - a.easyToRankScore);
  scored.forEach((s, i) => { s.rank = i + 1; });

  return scored;
}

// ---------------------------------------------------------------------------
// Lightweight config (only needs OPENAI_API_KEY)
// ---------------------------------------------------------------------------

function buildLightweightConfig(): Config {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required.');
    process.exit(1);
  }

  return {
    openai: {
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
    // Placeholders — never used by KeywordResearchService
    wordpress: {
      url: 'https://placeholder.local',
      username: 'unused',
      appPassword: 'unused',
      category: 'Uncategorized',
    },
    trends: { geo: 'US', category: 'all', sources: ['openai'], customFeeds: [] },
    diversity: { similarityThreshold: 0.35, lookbackDays: 30, lookbackCount: 20, maxCandidates: 10 },
    unsplash: { accessKey: '', enabled: false },
    voice: {
      tone: 'conversational',
      perspective: 'second_person',
      personality: '',
      avoidWords: [],
      preferredPhrases: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const niche = process.argv[2] || process.env.KEYWORD_NICHE;
  if (!niche) {
    console.error('Usage: npm run keyword-plan -- "your niche"');
    console.error('   or: KEYWORD_NICHE="your niche" npm run keyword-plan');
    process.exit(1);
  }

  console.log(`\nKeyword Planner — researching easy-to-rank keywords for: "${niche}"\n`);

  const config = buildLightweightConfig();
  const service = new KeywordResearchService(config);

  // 1. Expand niche to seed topics
  log.info('Step 1: Expanding niche to seed topics');
  const seeds = await service.expandNicheToSeeds(niche);
  console.log(`Seed topics: ${seeds.join(', ')}\n`);

  // 2. Research keywords for each seed
  log.info('Step 2: Researching keywords for each seed');
  const allMetrics: KeywordMetrics[] = [];
  for (const seed of seeds) {
    console.log(`  Researching: "${seed}"`);
    const metrics = await service.researchKeywords(seed, []);
    allMetrics.push(...metrics);
  }

  // 3. Deduplicate
  const seen = new Set<string>();
  const unique = allMetrics.filter(m => {
    const key = m.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`\nCollected ${unique.length} unique keywords\n`);

  // 4. Classify intent
  log.info('Step 3: Classifying search intent');
  let classified: KeywordMetrics[];
  try {
    classified = await service.classifyIntent(unique);
  } catch {
    log.warn('Intent classification failed, defaulting to informational');
    classified = unique;
  }

  // 5. Check cannibalization
  log.info('Step 4: Checking cannibalization');
  let cannibalization: CannibalizationResult[];
  try {
    cannibalization = await service.checkCannibalization(classified);
  } catch {
    log.warn('Cannibalization check failed, treating all as non-cannibalized');
    cannibalization = classified.map(c => ({
      keyword: c.keyword,
      overlappingArticles: [],
      isCannibalized: false,
      suggestedLongTails: [],
    }));
  }

  // 6. Score with easy-to-rank formula
  log.info('Step 5: Scoring keywords for easy-to-rank opportunities');
  const scored = scoreForEasyRank(classified, cannibalization);

  // 7. Build output
  const tokenUsage = service.getTokenUsage();
  const output = {
    generatedAt: new Date().toISOString(),
    niche,
    seedTopicsExpanded: seeds,
    scoringStrategy: 'easy_to_rank',
    topKeywords: scored.slice(0, 20),
    allKeywords: scored,
    cannibalizationReport: cannibalization.filter(c => c.isCannibalized),
    tokenUsage,
  };

  // 8. Write output file
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Full plan saved to ${OUTPUT_FILE}\n`);

  // 9. Pretty-print top 10
  console.log('='.repeat(80));
  console.log(' TOP 10 EASY-TO-RANK KEYWORDS');
  console.log('='.repeat(80));
  console.log('');
  console.log(
    'Rank  Score   Diff  Vol        Trend      Intent          Keyword',
  );
  console.log('-'.repeat(80));

  for (const kw of scored.slice(0, 10)) {
    const rank = String(kw.rank).padStart(2);
    const score = kw.easyToRankScore.toFixed(1).padStart(5);
    const diff = String(kw.estimatedDifficulty).padStart(4);
    const vol = kw.estimatedVolume.padEnd(10);
    const trend = kw.trend.padEnd(10);
    const intent = kw.intent.padEnd(15);
    const flag = kw.isCannibalized ? ' [CANNIBALIZED]' : '';
    console.log(
      `  ${rank}  ${score}  ${diff}  ${vol} ${trend} ${intent} ${kw.keyword}${flag}`,
    );
  }

  console.log('');
  console.log(
    `Tokens used: ${tokenUsage.totalTokens} (prompt: ${tokenUsage.promptTokens}, completion: ${tokenUsage.completionTokens})`,
  );
  console.log('');
}

main().catch(err => {
  console.error('Keyword planner failed:', err);
  process.exit(1);
});
