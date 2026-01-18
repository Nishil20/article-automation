import OpenAI from 'openai';
import {
  Config,
  ArticleKeywords,
  ArticleOutline,
  GeneratedArticle,
  TrendingTopic,
  CompetitorAnalysis,
  UniqueAngle,
} from '../types/index.js';
import {
  SYSTEM_PROMPT,
  getKeywordGenerationPrompt,
  getOutlineGenerationPrompt,
  getArticleGenerationPrompt,
  getMetaGenerationPrompt,
  getCompetitorAnalysisPrompt,
  getUniqueAnglePrompt,
  getOutlineWithAnglePrompt,
} from '../prompts/article.js';
import { logger } from '../utils/logger.js';

const log = logger.child('OpenAI');

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private config: Config;
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.model = config.openai.model;
    this.config = config;
  }

  /**
   * Make a completion request and track token usage
   */
  private async complete(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    });

    // Track usage
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

  /**
   * Strip markdown code block wrappers from content
   */
  private stripCodeBlocks(content: string): string {
    let cleaned = content.trim();
    
    // More robust regex to handle various code block formats
    // Matches: ```html, ``` html, ```HTML, etc. at the start
    const codeBlockStartRegex = /^`{3,}\s*(?:html|json|javascript|css|xml|markdown|md)?\s*\n?/i;
    cleaned = cleaned.replace(codeBlockStartRegex, '');
    
    // Remove closing code block marker (handles ``` at the end with optional whitespace)
    const codeBlockEndRegex = /\n?`{3,}\s*$/;
    cleaned = cleaned.replace(codeBlockEndRegex, '');
    
    // Also handle case where content might have multiple code blocks or inline markers
    // Remove any remaining standalone ``` markers on their own lines
    cleaned = cleaned.replace(/^\s*`{3,}\s*$/gm, '');
    
    return cleaned.trim();
  }

  /**
   * Parse JSON from OpenAI response, handling markdown code blocks
   */
  private parseJSON<T>(content: string): T {
    const cleaned = this.stripCodeBlocks(content);

    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      log.error('Failed to parse JSON response', { content, error });
      throw new Error(`Failed to parse OpenAI JSON response: ${error}`);
    }
  }

  /**
   * Step 1: Generate keywords from topic
   */
  async generateKeywords(topic: TrendingTopic): Promise<ArticleKeywords> {
    log.info(`Generating keywords for topic: ${topic.title}`);

    const prompt = getKeywordGenerationPrompt(topic.title, topic.relatedQueries);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.5);
    const keywords = this.parseJSON<ArticleKeywords>(response);

    log.info('Keywords generated', {
      primary: keywords.primary,
      secondaryCount: keywords.secondary.length,
      lsiCount: keywords.lsiKeywords.length,
    });

    return keywords;
  }

  /**
   * Analyze competitors for a topic
   */
  async analyzeCompetitors(topic: TrendingTopic): Promise<CompetitorAnalysis> {
    log.info(`Analyzing competitors for: ${topic.title}`);

    const prompt = getCompetitorAnalysisPrompt(topic.title, topic.relatedQueries);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.5);
    
    // Parse and validate averageDepth
    const rawAnalysis = this.parseJSON<CompetitorAnalysis & { averageDepth: string }>(response);
    
    // Normalize averageDepth to valid values
    const validDepths = ['shallow', 'medium', 'deep'] as const;
    const normalizedDepth = validDepths.includes(rawAnalysis.averageDepth as typeof validDepths[number])
      ? rawAnalysis.averageDepth as 'shallow' | 'medium' | 'deep'
      : 'medium';

    const analysis: CompetitorAnalysis = {
      ...rawAnalysis,
      averageDepth: normalizedDepth,
    };

    log.info('Competitor analysis complete', {
      commonTopicsCount: analysis.commonTopics.length,
      contentGapsCount: analysis.contentGaps.length,
      uniqueOpportunitiesCount: analysis.uniqueOpportunities.length,
      averageDepth: analysis.averageDepth,
    });

    return analysis;
  }

  /**
   * Generate a unique angle based on competitor analysis
   */
  async generateUniqueAngle(
    topic: TrendingTopic,
    competitorAnalysis: CompetitorAnalysis,
    keywords: ArticleKeywords
  ): Promise<UniqueAngle> {
    log.info(`Generating unique angle for: ${topic.title}`);

    const prompt = getUniqueAnglePrompt(topic.title, competitorAnalysis, keywords);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.7);
    const uniqueAngle = this.parseJSON<UniqueAngle>(response);

    log.info('Unique angle generated', {
      angle: uniqueAngle.angle.substring(0, 100) + '...',
      targetAudience: uniqueAngle.targetAudience,
    });

    return uniqueAngle;
  }

  /**
   * Step 2: Generate article outline
   */
  async generateOutline(
    topic: TrendingTopic,
    keywords: ArticleKeywords
  ): Promise<ArticleOutline> {
    log.info(`Generating outline for: ${topic.title}`);

    const prompt = getOutlineGenerationPrompt(topic.title, keywords);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.6);
    const outline = this.parseJSON<ArticleOutline>(response);

    log.info('Outline generated', {
      title: outline.title,
      sectionCount: outline.sections.length,
    });

    return outline;
  }

  /**
   * Generate article outline with unique angle
   */
  async generateOutlineWithAngle(
    topic: TrendingTopic,
    keywords: ArticleKeywords,
    uniqueAngle: UniqueAngle
  ): Promise<ArticleOutline> {
    log.info(`Generating outline with unique angle for: ${topic.title}`);

    const prompt = getOutlineWithAnglePrompt(topic.title, keywords, uniqueAngle);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.6);
    const outline = this.parseJSON<ArticleOutline>(response);

    log.info('Outline with unique angle generated', {
      title: outline.title,
      sectionCount: outline.sections.length,
      angle: uniqueAngle.angle.substring(0, 50) + '...',
    });

    return outline;
  }

  /**
   * Step 3: Generate full article content
   */
  async generateContent(
    outline: ArticleOutline,
    keywords: ArticleKeywords
  ): Promise<string> {
    log.info(`Generating article content for: ${outline.title}`);

    const prompt = getArticleGenerationPrompt(
      outline,
      keywords,
      this.config.voice
    );
    
    // Use slightly higher temperature for more creative content
    const rawContent = await this.complete(SYSTEM_PROMPT, prompt, 0.75);
    
    // Strip any markdown code blocks that the AI might have wrapped around the HTML
    const content = this.stripCodeBlocks(rawContent);

    const wordCount = content.split(/\s+/).length;
    log.info(`Article content generated: ${wordCount} words`);

    return content;
  }

  /**
   * Step 4: Generate meta information
   */
  async generateMeta(
    title: string,
    content: string,
    keywords: ArticleKeywords
  ): Promise<{
    metaTitle: string;
    metaDescription: string;
    slug: string;
    excerpt: string;
  }> {
    log.info('Generating meta information');

    const prompt = getMetaGenerationPrompt(title, content, keywords);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.5);
    const meta = this.parseJSON<{
      metaTitle: string;
      metaDescription: string;
      slug: string;
      excerpt: string;
    }>(response);

    log.info('Meta generated', {
      metaTitle: meta.metaTitle,
      slug: meta.slug,
    });

    return meta;
  }

  /**
   * Full article generation pipeline (without humanization)
   */
  async generateArticle(topic: TrendingTopic): Promise<GeneratedArticle> {
    log.info(`Starting article generation pipeline for: ${topic.title}`);

    // Step 1: Keywords
    const keywords = await this.generateKeywords(topic);

    // Step 2: Outline
    const outline = await this.generateOutline(topic, keywords);

    // Step 3: Content
    const content = await this.generateContent(outline, keywords);

    // Step 4: Meta
    const meta = await this.generateMeta(outline.title, content, keywords);

    const wordCount = content.split(/\s+/).length;

    log.info('Article generation complete', {
      title: outline.title,
      wordCount,
      totalTokens: this.totalUsage.totalTokens,
    });

    return {
      title: outline.title,
      content,
      slug: meta.slug,
      excerpt: meta.excerpt,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      keywords,
      wordCount,
    };
  }

  /**
   * Enhanced article generation with competitor analysis and unique angle
   */
  async generateArticleEnhanced(topic: TrendingTopic): Promise<{
    article: GeneratedArticle;
    competitorAnalysis: CompetitorAnalysis;
    uniqueAngle: UniqueAngle;
  }> {
    log.info(`Starting ENHANCED article generation for: ${topic.title}`);

    // Step 1: Analyze competitors
    const competitorAnalysis = await this.analyzeCompetitors(topic);

    // Step 2: Generate keywords
    const keywords = await this.generateKeywords(topic);

    // Step 3: Generate unique angle based on competitor gaps
    const uniqueAngle = await this.generateUniqueAngle(topic, competitorAnalysis, keywords);

    // Step 4: Generate outline incorporating unique angle
    const outline = await this.generateOutlineWithAngle(topic, keywords, uniqueAngle);

    // Step 5: Generate content
    const content = await this.generateContent(outline, keywords);

    // Step 6: Generate meta
    const meta = await this.generateMeta(outline.title, content, keywords);

    const wordCount = content.split(/\s+/).length;

    log.info('Enhanced article generation complete', {
      title: outline.title,
      wordCount,
      uniqueAngle: uniqueAngle.angle.substring(0, 50) + '...',
      totalTokens: this.totalUsage.totalTokens,
    });

    return {
      article: {
        title: outline.title,
        content,
        slug: meta.slug,
        excerpt: meta.excerpt,
        metaTitle: meta.metaTitle,
        metaDescription: meta.metaDescription,
        keywords,
        wordCount,
      },
      competitorAnalysis,
      uniqueAngle,
    };
  }

  /**
   * Get total token usage for this session
   */
  getTokenUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Reset token usage tracking
   */
  resetTokenUsage(): void {
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }
}
