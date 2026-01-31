import googleTrends from 'google-trends-api';
import Parser from 'rss-parser';
import OpenAI from 'openai';
import { TrendingTopic, Config } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { checkTopicSimilarity, getRecentArticleTitles, RecentArticle } from '../utils/topic-diversity.js';

const log = logger.child('Trends');

// RSS Parser instance
const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ArticleBot/1.0)',
  },
});

// RSS Feed sources organized by category
const RSS_FEEDS: Record<string, string[]> = {
  general: [
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
    'https://feeds.bbci.co.uk/news/rss.xml',
    'https://www.reuters.com/rssFeed/topNews',
  ],
  technology: [
    'https://feeds.feedburner.com/TechCrunch/',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://www.wired.com/feed/rss',
  ],
  business: [
    'https://feeds.nbcnews.com/nbcnews/public/business',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  ],
  health: [
    'https://www.medicalnewstoday.com/newsfeeds/rss/medical-news.xml',
    'https://feeds.nbcnews.com/nbcnews/public/health',
  ],
  science: [
    'https://www.sciencedaily.com/rss/all.xml',
    'https://www.newscientist.com/feed/home',
  ],
};

// Fallback topics when all sources fail
const FALLBACK_TOPICS: TrendingTopic[] = [
  {
    title: 'AI in Healthcare 2026',
    relatedQueries: ['artificial intelligence medical', 'AI diagnosis', 'machine learning healthcare', 'AI drug discovery', 'healthcare automation'],
  },
  {
    title: 'Remote Work Productivity Tips',
    relatedQueries: ['work from home tips', 'remote work tools', 'productivity apps', 'home office setup', 'virtual collaboration'],
  },
  {
    title: 'Sustainable Living Guide',
    relatedQueries: ['eco-friendly lifestyle', 'reduce carbon footprint', 'sustainable products', 'green living tips', 'zero waste'],
  },
  {
    title: 'Personal Finance Strategies',
    relatedQueries: ['budgeting tips', 'investment strategies', 'saving money', 'financial planning', 'passive income'],
  },
  {
    title: 'Mental Health and Wellness',
    relatedQueries: ['stress management', 'mindfulness techniques', 'anxiety relief', 'self-care tips', 'work life balance'],
  },
];

interface TrendingSearchResult {
  default: {
    trendingSearchesDays: Array<{
      date: string;
      trendingSearches: Array<{
        title: {
          query: string;
        };
        formattedTraffic: string;
        relatedQueries: Array<{
          query: string;
        }>;
        articles: Array<{
          title: string;
          snippet: string;
        }>;
      }>;
    }>;
  };
}

interface RealTimeTrendResult {
  storySummaries: {
    trendingStories: Array<{
      title: string;
      entityNames: string[];
      articles: Array<{
        articleTitle: string;
        snippet: string;
      }>;
    }>;
  };
}

export class TrendsService {
  private config: Config['trends'];
  private openaiClient: OpenAI | null = null;
  private openaiModel: string = 'gpt-4o';
  private diversityConfig: Config['diversity'] | null = null;
  private recentHistory: RecentArticle[] = [];

  constructor(config: Config['trends'], openaiConfig?: Config['openai']) {
    this.config = config;

    // Initialize OpenAI client if config provided
    if (openaiConfig?.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiConfig.apiKey,
        maxRetries: 5,
      });
      this.openaiModel = openaiConfig.model || 'gpt-4o';
    }
  }

  setDiversityConfig(config: Config['diversity']): void {
    this.diversityConfig = config;
  }

  setRecentHistory(history: RecentArticle[]): void {
    this.recentHistory = history;
  }

  /**
   * Check whether a candidate topic is diverse enough from recent history.
   */
  private isTopicDiverse(topic: TrendingTopic): boolean {
    if (!this.diversityConfig || this.recentHistory.length === 0) {
      return true;
    }
    const result = checkTopicSimilarity(
      topic.title,
      topic.relatedQueries,
      this.recentHistory,
      this.diversityConfig.similarityThreshold
    );
    if (result.isTooSimilar) {
      log.info(`Topic rejected (similarity: ${result.highestScore.toFixed(2)} >= ${this.diversityConfig.similarityThreshold}): "${topic.title}" too similar to "${result.mostSimilarTitle}"`);
    }
    return !result.isTooSimilar;
  }

  /**
   * Extract keywords from text (title or description)
   */
  private extractKeywords(text: string): string[] {
    // Remove HTML tags
    const cleanText = text.replace(/<[^>]*>/g, '');
    
    // Common stop words to filter out
    const stopWords = new Set([
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

    // Extract words, filter stop words, keep significant ones
    const words = cleanText
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Get unique words and return top ones
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Clean and normalize a title for use as a topic
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/<[^>]*>/g, '') // Remove HTML
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '') // Trim special chars
      .trim();
  }

  /**
   * Fetch topics from RSS feeds
   */
  async getRSSTopics(category?: string): Promise<TrendingTopic[]> {
    const categoryKey = category && RSS_FEEDS[category] ? category : 'general';
    const feeds = [...RSS_FEEDS[categoryKey]];
    
    // Also include general feeds if category-specific
    if (categoryKey !== 'general') {
      feeds.push(...RSS_FEEDS.general.slice(0, 1));
    }

    // Append user-configured custom feeds
    if (this.config.customFeeds && this.config.customFeeds.length > 0) {
      feeds.push(...this.config.customFeeds);
      log.info(`Added ${this.config.customFeeds.length} custom feeds to pool`);
    }

    log.info(`Fetching RSS topics from ${feeds.length} feeds (category: ${categoryKey})`);

    const topics: TrendingTopic[] = [];
    const seenTitles = new Set<string>();

    // Fetch feeds in parallel with timeout
    const feedPromises = feeds.map(async (feedUrl) => {
      try {
        const feed = await rssParser.parseURL(feedUrl);
        return feed.items || [];
      } catch (error) {
        log.debug(`Failed to fetch RSS feed: ${feedUrl}`, error);
        return [];
      }
    });

    const feedResults = await Promise.allSettled(feedPromises);
    
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        for (const item of result.value.slice(0, 10)) {
          const title = this.cleanTitle(item.title || '');
          
          // Skip empty, duplicate, or very short titles
          if (!title || title.length < 10 || seenTitles.has(title.toLowerCase())) {
            continue;
          }
          
          seenTitles.add(title.toLowerCase());
          
          // Extract keywords from title and description
          const titleKeywords = this.extractKeywords(title);
          const descKeywords = this.extractKeywords(item.contentSnippet || item.content || '');
          const relatedQueries = [...new Set([...titleKeywords, ...descKeywords])].slice(0, 8);

          topics.push({
            title,
            relatedQueries,
            category: categoryKey,
          });
        }
      }
    }

    log.info(`Found ${topics.length} topics from RSS feeds`);
    return topics;
  }

  /**
   * Fetch daily trending searches from Google Trends
   */
  async getDailyTrends(): Promise<TrendingTopic[]> {
    log.info(`Fetching daily trends for geo: ${this.config.geo}`);

    try {
      const results = await googleTrends.dailyTrends({
        geo: this.config.geo,
      });

      const data: TrendingSearchResult = JSON.parse(results);
      const topics: TrendingTopic[] = [];

      // Get trends from the most recent day
      const recentDay = data.default.trendingSearchesDays[0];
      if (!recentDay) {
        log.warn('No trending searches found for today');
        return [];
      }

      for (const trend of recentDay.trendingSearches) {
        topics.push({
          title: trend.title.query,
          trafficVolume: trend.formattedTraffic,
          relatedQueries: trend.relatedQueries?.map(q => q.query) || [],
        });
      }

      log.info(`Found ${topics.length} daily trending topics`);
      return topics;
    } catch (error) {
      log.error('Failed to fetch daily trends', error);
      throw error;
    }
  }

  /**
   * Fetch real-time trending stories
   */
  async getRealTimeTrends(category?: string): Promise<TrendingTopic[]> {
    log.info(`Fetching real-time trends for geo: ${this.config.geo}, category: ${category || 'all'}`);

    try {
      const options: { geo: string; category?: string } = {
        geo: this.config.geo,
      };

      // Category mapping for Google Trends
      const categoryMap: Record<string, string> = {
        all: 'all',
        entertainment: 'e',
        business: 'b',
        technology: 't',
        health: 'm',
        sports: 's',
        science: 'h',
      };

      if (category && category !== 'all') {
        options.category = categoryMap[category] || category;
      }

      const results = await googleTrends.realTimeTrends(options);
      const data: RealTimeTrendResult = JSON.parse(results);
      const topics: TrendingTopic[] = [];

      if (!data.storySummaries?.trendingStories) {
        log.warn('No real-time trending stories found');
        return [];
      }

      for (const story of data.storySummaries.trendingStories) {
        topics.push({
          title: story.title,
          relatedQueries: story.entityNames || [],
          category: category,
        });
      }

      log.info(`Found ${topics.length} real-time trending topics`);
      return topics;
    } catch (error) {
      log.error('Failed to fetch real-time trends', error);
      throw error;
    }
  }

  /**
   * Get related queries for a specific topic
   */
  async getRelatedQueries(keyword: string): Promise<string[]> {
    log.info(`Fetching related queries for: ${keyword}`);

    try {
      const results = await googleTrends.relatedQueries({
        keyword,
        geo: this.config.geo,
      });

      const data = JSON.parse(results);
      const queries: string[] = [];

      // Extract top related queries
      const topQueries = data.default?.rankedList?.[0]?.rankedKeyword;
      if (topQueries) {
        for (const item of topQueries.slice(0, 10)) {
          queries.push(item.query);
        }
      }

      // Extract rising queries
      const risingQueries = data.default?.rankedList?.[1]?.rankedKeyword;
      if (risingQueries) {
        for (const item of risingQueries.slice(0, 5)) {
          if (!queries.includes(item.query)) {
            queries.push(item.query);
          }
        }
      }

      log.info(`Found ${queries.length} related queries`);
      return queries;
    } catch (error) {
      log.error('Failed to fetch related queries', error);
      return [];
    }
  }

  /**
   * Try to get topic from a specific source
   */
  private async trySource(source: string, category?: string): Promise<TrendingTopic | null> {
    switch (source) {
      case 'rss':
        try {
          const rssTopics = await this.getRSSTopics(category);
          if (rssTopics.length > 0) {
            // Shuffle candidates for variety
            const maxCandidates = this.diversityConfig?.maxCandidates ?? 10;
            const candidates = rssTopics.slice(0, maxCandidates);
            for (let i = candidates.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }
            // Return first candidate that passes diversity check
            for (const candidate of candidates) {
              if (this.isTopicDiverse(candidate)) {
                log.info(`Selected RSS topic for article: ${candidate.title}`);
                return candidate;
              }
            }
            log.info('All RSS candidates rejected by diversity filter');
          }
        } catch (error) {
          log.warn('RSS feeds unavailable', error);
        }
        break;

      case 'google':
        try {
          log.info('Trying Google Trends...');
          let topics = await this.getDailyTrends();

          if (topics.length === 0) {
            topics = await this.getRealTimeTrends(category);
          }

          if (topics.length > 0) {
            // Check each topic against diversity filter
            for (const topic of topics) {
              if (topic.relatedQueries.length < 5) {
                const additionalQueries = await this.getRelatedQueries(topic.title);
                topic.relatedQueries = [
                  ...new Set([...topic.relatedQueries, ...additionalQueries]),
                ];
              }

              if (this.isTopicDiverse(topic)) {
                log.info(`Selected Google Trends topic for article: ${topic.title}`);
                return topic;
              }
            }
            log.info('All Google Trends candidates rejected by diversity filter');
          }
        } catch (error) {
          log.warn('Google Trends unavailable', error);
        }
        break;

      case 'openai':
        try {
          log.info('Trying OpenAI for topic generation...');
          const recentTitlesStr = getRecentArticleTitles(this.recentHistory);
          const openaiTopic = await this.getOpenAITopic(category, recentTitlesStr);
          if (openaiTopic && this.isTopicDiverse(openaiTopic)) {
            return openaiTopic;
          }
          if (openaiTopic) {
            log.info('OpenAI topic rejected by diversity filter');
          }
        } catch (error) {
          log.warn('OpenAI topic generation failed', error);
        }
        break;

      case 'fallback': {
        // Shuffle fallback topics and return first that passes diversity check
        const shuffledFallbacks = [...FALLBACK_TOPICS];
        for (let i = shuffledFallbacks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledFallbacks[i], shuffledFallbacks[j]] = [shuffledFallbacks[j], shuffledFallbacks[i]];
        }
        for (const fallback of shuffledFallbacks) {
          if (this.isTopicDiverse(fallback)) {
            log.info(`Using fallback topic: ${fallback.title}`);
            return fallback;
          }
        }
        // If all rejected, return a random one anyway (last resort)
        return this.getRandomFallbackTopic();
      }
    }

    return null;
  }

  /**
   * Get the best topic for article generation
   * Priority is configurable via TOPIC_SOURCES env var
   * Default: Manual Topic -> RSS -> Google Trends -> OpenAI -> Static Fallback
   */
  async getTopicForArticle(): Promise<TrendingTopic | null> {
    // Check for manual topic override from environment (always takes priority)
    const manualTopic = process.env.ARTICLE_TOPIC;
    if (manualTopic) {
      log.info(`Using manual topic from environment: ${manualTopic}`);
      
      let relatedQueries: string[] = [];
      try {
        relatedQueries = await this.getRelatedQueries(manualTopic);
      } catch {
        relatedQueries = this.extractKeywords(manualTopic);
      }
      
      return {
        title: manualTopic,
        relatedQueries: relatedQueries.length > 0 ? relatedQueries : [manualTopic.toLowerCase()],
      };
    }

    const category = this.config.category !== 'all' ? this.config.category : undefined;
    const sources = this.config.sources || ['rss', 'google', 'openai', 'fallback'];
    
    log.info(`Topic source priority: ${sources.join(' -> ')}`);

    // Try each source in configured order
    for (const source of sources) {
      const topic = await this.trySource(source, category);
      if (topic) {
        return topic;
      }
    }

    // If no sources succeeded and fallback wasn't in the list, use it anyway
    log.warn('All configured sources failed, using fallback topic');
    return this.getRandomFallbackTopic();
  }

  /**
   * Generate a trending topic using OpenAI
   */
  async getOpenAITopic(category?: string, recentArticleTitles?: string): Promise<TrendingTopic | null> {
    if (!this.openaiClient) {
      log.warn('OpenAI client not configured');
      return null;
    }

    log.info('Generating topic using OpenAI...');

    const categoryContext = category && category !== 'all'
      ? `Focus on the ${category} category.`
      : 'Consider general interest topics.';

    const recentContext = recentArticleTitles
      ? `\n\nIMPORTANT: The following articles were recently published. Generate a topic on a DIFFERENT sub-topic to ensure variety:\n${recentArticleTitles}`
      : '';

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: this.openaiModel,
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert and trend analyst. Generate a single trending topic that would make a great article for today. The topic should be:
- Currently relevant and timely
- Have good search potential
- Be specific enough to write about
- Appeal to a broad audience

Respond in JSON format only:
{
  "title": "The main topic title",
  "relatedQueries": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`,
          },
          {
            role: 'user',
            content: `Generate a trending topic for an SEO article. ${categoryContext} Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.${recentContext}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Parse JSON response (handle potential markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      
      const topic: TrendingTopic = {
        title: parsed.title,
        relatedQueries: parsed.relatedQueries || [],
        category: category,
      };

      log.info(`Generated OpenAI topic: ${topic.title}`);
      return topic;
    } catch (error) {
      log.error('Failed to generate topic with OpenAI', error);
      return null;
    }
  }

  /**
   * Get a random fallback topic when all sources are unavailable
   */
  private getRandomFallbackTopic(): TrendingTopic {
    const randomIndex = Math.floor(Math.random() * FALLBACK_TOPICS.length);
    const topic = FALLBACK_TOPICS[randomIndex];
    log.info(`Using fallback topic: ${topic.title}`);
    return topic;
  }
}
