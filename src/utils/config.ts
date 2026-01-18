import { config as dotenvConfig } from 'dotenv';
import { Config, ConfigSchema, VoiceConfig, TopicSource } from '../types/index.js';

// Load environment variables
dotenvConfig();

// Default AI words to avoid (these sound robotic)
const DEFAULT_AVOID_WORDS = [
  'delve',
  'landscape',
  'crucial',
  'leverage',
  'robust',
  'comprehensive',
  'facilitate',
  'utilize',
  'furthermore',
  'additionally',
  'subsequently',
  'consequently',
  'nevertheless',
  'notwithstanding',
  'aforementioned',
  'henceforth',
  'thereby',
  'wherein',
  'paramount',
  'pivotal',
  'seamless',
  'synergy',
  'holistic',
  'paradigm',
  'streamline',
  'cutting-edge',
  'game-changer',
  'best-in-class',
  'world-class',
  'state-of-the-art',
];

// Default natural phrases humans use
const DEFAULT_PREFERRED_PHRASES = [
  "Here's the thing",
  "Look",
  "The truth is",
  "Honestly",
  "Let's be real",
  "Here's what I mean",
  "Think about it this way",
  "You know what?",
  "The bottom line is",
  "In plain English",
  "Simply put",
  "Long story short",
  "Here's the deal",
  "Real talk",
  "No sugarcoating it",
];

// Default topic sources in priority order
const DEFAULT_TOPIC_SOURCES: TopicSource[] = ['rss', 'google', 'openai', 'fallback'];

// Valid topic source values
const VALID_SOURCES = new Set(['rss', 'google', 'openai', 'fallback']);

function parseTopicSources(envValue?: string): TopicSource[] {
  if (!envValue) {
    return DEFAULT_TOPIC_SOURCES;
  }
  
  const sources = envValue
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => VALID_SOURCES.has(s)) as TopicSource[];
  
  return sources.length > 0 ? sources : DEFAULT_TOPIC_SOURCES;
}

function getVoiceConfig(): VoiceConfig {
  const tone = process.env.VOICE_TONE || 'conversational';
  const perspective = process.env.VOICE_PERSPECTIVE || 'second_person';
  const personality = process.env.VOICE_PERSONALITY || 'friendly expert who uses analogies and real-world examples';
  
  // Parse avoid words from env or use defaults
  const avoidWordsEnv = process.env.VOICE_AVOID_WORDS;
  const avoidWords = avoidWordsEnv 
    ? avoidWordsEnv.split(',').map(w => w.trim())
    : DEFAULT_AVOID_WORDS;
  
  // Parse preferred phrases from env or use defaults
  const preferredPhrasesEnv = process.env.VOICE_PREFERRED_PHRASES;
  const preferredPhrases = preferredPhrasesEnv
    ? preferredPhrasesEnv.split(',').map(p => p.trim())
    : DEFAULT_PREFERRED_PHRASES;

  return {
    tone: tone as VoiceConfig['tone'],
    perspective: perspective as VoiceConfig['perspective'],
    personality,
    avoidWords,
    preferredPhrases,
  };
}

export function loadConfig(): Config {
  const rawConfig = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
    wordpress: {
      url: process.env.WP_URL || '',
      username: process.env.WP_USERNAME || '',
      appPassword: process.env.WP_APP_PASSWORD || '',
      category: process.env.WP_CATEGORY || 'Uncategorized',
    },
    trends: {
      geo: process.env.TRENDS_GEO || 'US',
      category: process.env.TRENDS_CATEGORY || 'all',
      sources: parseTopicSources(process.env.TOPIC_SOURCES),
    },
    unsplash: {
      accessKey: process.env.UNSPLASH_ACCESS_KEY || '',
      enabled: process.env.UNSPLASH_ENABLED !== 'false', // Enabled by default if key is provided
    },
    voice: getVoiceConfig(),
  };

  // Validate configuration
  const result = ConfigSchema.safeParse(rawConfig);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}

export function getConfig(): Config {
  return loadConfig();
}
