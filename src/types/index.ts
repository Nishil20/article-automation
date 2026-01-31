import { z } from 'zod';

// Voice configuration for humanization
export const VoiceConfigSchema = z.object({
  tone: z.enum(['conversational', 'professional', 'casual', 'authoritative']),
  perspective: z.enum(['first_person', 'second_person', 'third_person']),
  personality: z.string(),
  avoidWords: z.array(z.string()),
  preferredPhrases: z.array(z.string()),
});

export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

// Topic from Google Trends
export interface TrendingTopic {
  title: string;
  relatedQueries: string[];
  trafficVolume?: string;
  category?: string;
}

// Keywords generated for an article
export interface ArticleKeywords {
  primary: string;
  secondary: string[];
  lsiKeywords: string[]; // Latent Semantic Indexing keywords
}

// Article outline structure
export interface ArticleOutline {
  title: string;
  introduction: string;
  sections: ArticleSection[];
  conclusion: string;
}

export interface ArticleSection {
  heading: string; // H2 heading
  subheadings?: string[]; // H3 subheadings
  keyPoints: string[];
}

// Featured image data (from Unsplash)
export interface FeaturedImage {
  url: string;
  photographer: string;
  photographerUrl: string;
}

// Generated article content
export interface GeneratedArticle {
  title: string;
  content: string; // HTML content
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: ArticleKeywords;
  wordCount: number;
  featuredImage?: FeaturedImage;
}

// WordPress post data
export interface WordPressPostData {
  title: string;
  content: string;
  slug: string;
  excerpt: string;
  status: 'publish' | 'draft' | 'future';
  categories: number[];
  date?: string; // ISO date string for scheduling
  featured_media?: number; // Media ID for featured image
  meta?: {
    // Yoast SEO
    _yoast_wpseo_title?: string;
    _yoast_wpseo_metadesc?: string;
    // Yoast OG/Twitter
    _yoast_wpseo_opengraph_title?: string;
    _yoast_wpseo_opengraph_description?: string;
    _yoast_wpseo_opengraph_image?: string;
    _yoast_wpseo_twitter_title?: string;
    _yoast_wpseo_twitter_description?: string;
    _yoast_wpseo_twitter_image?: string;
    // RankMath SEO
    rank_math_focus_keyword?: string;
    rank_math_description?: string;
    rank_math_title?: string;
    // RankMath OG/Twitter
    rank_math_facebook_title?: string;
    rank_math_facebook_description?: string;
    rank_math_facebook_image?: string;
    rank_math_twitter_use_facebook?: string;
  };
}

// WordPress API response
export interface WordPressPostResponse {
  id: number;
  link: string;
  status: string;
  title: {
    rendered: string;
  };
}

// Topic source types for configurable priority
export const TopicSourceSchema = z.enum(['rss', 'google', 'openai', 'fallback']);
export type TopicSource = z.infer<typeof TopicSourceSchema>;

// Configuration schema
export const ConfigSchema = z.object({
  openai: z.object({
    apiKey: z.string().min(1, 'OpenAI API key is required'),
    model: z.string().default('gpt-4o'),
  }),
  wordpress: z.object({
    url: z.string().url('WordPress URL must be a valid URL'),
    username: z.string().min(1, 'WordPress username is required'),
    appPassword: z.string().min(1, 'WordPress application password is required'),
    category: z.string().default('Uncategorized'),
  }),
  trends: z.object({
    geo: z.string().default('US'),
    category: z.string().default('all'),
    sources: z.array(TopicSourceSchema).default(['rss', 'google', 'openai', 'fallback']),
  }),
  unsplash: z.object({
    accessKey: z.string().default(''),
    enabled: z.boolean().default(true),
  }),
  voice: VoiceConfigSchema,
});

export type Config = z.infer<typeof ConfigSchema>;

// Pipeline result types
export interface PipelineResult {
  success: boolean;
  topic?: TrendingTopic;
  article?: GeneratedArticle;
  postUrl?: string;
  error?: string;
}

// Logger levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ============================================
// Pipeline Enhancement Types
// ============================================

// Competitor analysis results
export interface CompetitorAnalysis {
  commonTopics: string[];       // What everyone covers
  contentGaps: string[];        // Missing angles/topics
  uniqueOpportunities: string[];// Fresh perspectives to explore
  averageDepth: 'shallow' | 'medium' | 'deep';
  keyDifferentiators: string[]; // What makes top content stand out
}

// Unique angle for differentiation
export interface UniqueAngle {
  angle: string;                // The unique perspective to take
  reasoning: string;            // Why this angle works
  targetAudience: string;       // Who this angle appeals to
  toneAdjustment?: string;      // How to adjust tone for this angle
}

// Readability scoring results
export interface ReadabilityScore {
  fleschKincaid: number;        // Grade level (lower = easier)
  fleschReadingEase: number;    // 0-100 score (higher = easier)
  avgSentenceLength: number;    // Words per sentence
  avgSyllablesPerWord: number;  // Complexity indicator
  readabilityLevel: 'very_easy' | 'easy' | 'standard' | 'difficult' | 'very_difficult';
  suggestions: string[];        // Improvement suggestions
}

// Related post for internal linking
export interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  link: string;
  relevanceScore: number;       // How relevant to current article
}

// Schema markup for Article JSON-LD
export interface ArticleSchemaMarkup {
  '@context': 'https://schema.org';
  '@type': 'Article';
  headline: string;
  description: string;
  author: {
    '@type': 'Person' | 'Organization';
    name: string;
    url?: string;
  };
  publisher: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  datePublished: string;
  dateModified: string;
  mainEntityOfPage: {
    '@type': 'WebPage';
    '@id': string;
  };
  image?: string | string[];
  keywords?: string;
  wordCount?: number;
  articleSection?: string;
}

// External link for authoritative source citations
export interface ExternalLink {
  url: string;
  anchorText: string;
  contextSentence: string;
}

// Originality check results
export interface OriginalityCheck {
  overallScore: number;         // 0-100 (higher = more original)
  genericPhrases: string[];     // Phrases that are too common
  cliches: string[];            // Clichéd expressions found
  uniqueElements: string[];     // What makes it original
  suggestions: string[];        // How to improve originality
}

// Topic cluster types for topical authority
export interface TopicCluster {
  id: string;
  pillarTopic: string;
  keywords: string[];
  articles: ClusterArticle[];
  createdAt: string;
  updatedAt: string;
}

export interface ClusterArticle {
  title: string;
  slug: string;
  url: string;
  publishedAt: string;
  keywords: string[];
  contentType: 'pillar' | 'cluster';
}

// ============================================
// Keyword Research Types
// ============================================

export type SearchIntent = 'informational' | 'transactional' | 'navigational' | 'commercial';

export interface KeywordSuggestion {
  keyword: string;
  source: string;
}

export interface KeywordMetrics {
  keyword: string;
  estimatedVolume: 'high' | 'medium' | 'low' | 'very_low';
  estimatedDifficulty: number;  // 0-100
  intent: SearchIntent;
  trend: 'rising' | 'stable' | 'declining';
  source: string;
}

export interface CannibalizationResult {
  keyword: string;
  overlappingArticles: Array<{
    title: string;
    slug: string;
    similarity: number;
    matchedKeywords: string[];
  }>;
  isCannibalized: boolean;
  suggestedLongTails: string[];
}

export interface KeywordPlan {
  primary: KeywordMetrics;
  secondary: KeywordMetrics[];
  longTails: string[];
  intentProfile: SearchIntent;
  cannibalizationReport: CannibalizationResult[];
  score: number;
}

export interface KeywordDataProvider {
  name: string;
  getKeywordSuggestions(seed: string): Promise<KeywordSuggestion[]>;
  getKeywordMetrics?(keywords: string[]): Promise<KeywordMetrics[]>;
  isAvailable(): boolean;
}
