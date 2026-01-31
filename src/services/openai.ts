import OpenAI from 'openai';
import {
  Config,
  ArticleKeywords,
  ArticleOutline,
  GeneratedArticle,
  TrendingTopic,
  CompetitorAnalysis,
  UniqueAngle,
  KeywordPlan,
  ExternalLink,
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
  getIntroductionPrompt,
  getSectionGenerationPrompt,
  getConclusionPrompt,
  getSectionExpansionPrompt,
  getFAQGenerationPrompt,
  getExternalLinksPrompt,
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
    temperature: number = 0.7,
    maxTokens?: number
  ): Promise<string> {
    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    };

    if (maxTokens) {
      params.max_tokens = maxTokens;
    }

    const response = await this.client.chat.completions.create(params);

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
    keywords: ArticleKeywords,
    recentArticleContext?: string
  ): Promise<UniqueAngle> {
    log.info(`Generating unique angle for: ${topic.title}`);

    const prompt = getUniqueAnglePrompt(topic.title, competitorAnalysis, keywords, recentArticleContext);
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

    // Step 5: Generate content section-by-section for better word count
    const content = await this.generateContentBySection(outline, keywords);

    // Step 6: Generate meta
    const meta = await this.generateMeta(outline.title, content, keywords);

    const wordCount = this.countWords(content);

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
   * Count words in HTML content (strips tags)
   */
  private countWords(html: string): number {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(/\s+/).length : 0;
  }

  /**
   * Generate article content section by section for better word count control
   */
  async generateContentBySection(
    outline: ArticleOutline,
    keywords: ArticleKeywords
  ): Promise<string> {
    log.info(`Generating article content section-by-section for: ${outline.title}`);

    const voiceConfig = this.config.voice;
    const parts: string[] = [];

    // 1. Generate introduction (150-200 words)
    log.info('Generating introduction...');
    const introPrompt = getIntroductionPrompt(outline.title, keywords, voiceConfig, outline.introduction);
    const rawIntro = await this.complete(SYSTEM_PROMPT, introPrompt, 0.75, 4096);
    const intro = this.stripCodeBlocks(rawIntro);
    parts.push(intro);
    log.info(`Introduction: ${this.countWords(intro)} words`);

    // 2. Generate each section individually (250-400 words each)
    const sectionContents: string[] = [];
    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      log.info(`Generating section ${i + 1}/${outline.sections.length}: ${section.heading}`);

      const sectionPrompt = getSectionGenerationPrompt(
        section, i, outline.sections.length, keywords, voiceConfig, outline.title
      );
      const rawSection = await this.complete(SYSTEM_PROMPT, sectionPrompt, 0.75, 4096);
      const sectionContent = this.stripCodeBlocks(rawSection);
      sectionContents.push(sectionContent);
      parts.push(sectionContent);
      log.info(`Section "${section.heading}": ${this.countWords(sectionContent)} words`);
    }

    // 3. Generate conclusion (150-200 words)
    log.info('Generating conclusion...');
    const conclusionPrompt = getConclusionPrompt(outline.title, keywords, voiceConfig, outline.conclusion);
    const rawConclusion = await this.complete(SYSTEM_PROMPT, conclusionPrompt, 0.75, 4096);
    const conclusion = this.stripCodeBlocks(rawConclusion);
    parts.push(conclusion);
    log.info(`Conclusion: ${this.countWords(conclusion)} words`);

    // 4. Assemble and check total word count
    let fullContent = parts.join('\n\n');
    let totalWords = this.countWords(fullContent);
    log.info(`Initial total word count: ${totalWords}`);

    // 5. If under 1400 words, expand the shortest section
    if (totalWords < 1400 && sectionContents.length > 0) {
      log.info('Word count below 1400, expanding shortest section...');

      let shortestIdx = 0;
      let shortestLen = Infinity;
      for (let i = 0; i < sectionContents.length; i++) {
        const wc = this.countWords(sectionContents[i]);
        if (wc < shortestLen) {
          shortestLen = wc;
          shortestIdx = i;
        }
      }

      const expandPrompt = getSectionExpansionPrompt(
        sectionContents[shortestIdx],
        outline.sections[shortestIdx].heading,
        outline.title,
        keywords
      );
      const rawExpanded = await this.complete(SYSTEM_PROMPT, expandPrompt, 0.75, 4096);
      const expanded = this.stripCodeBlocks(rawExpanded);

      // Replace the shortest section in parts (offset by 1 for intro)
      parts[shortestIdx + 1] = expanded;
      fullContent = parts.join('\n\n');
      totalWords = this.countWords(fullContent);
      log.info(`After expansion: ${totalWords} words`);
    }

    log.info(`Section-by-section generation complete: ${totalWords} words`);
    return fullContent;
  }

  /**
   * Generate FAQ questions and answers for an article
   */
  async generateFAQs(
    title: string,
    content: string,
    keywords: ArticleKeywords
  ): Promise<Array<{ question: string; answer: string }>> {
    log.info('Generating FAQ content');

    const prompt = getFAQGenerationPrompt(title, content, keywords);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.6);
    const parsed = this.parseJSON<{ faqs: Array<{ question: string; answer: string }> }>(response);

    log.info(`Generated ${parsed.faqs.length} FAQ items`);
    return parsed.faqs;
  }

  /**
   * Generate authoritative external links for E-E-A-T signals
   */
  async generateExternalLinks(
    title: string,
    content: string,
    keywords: ArticleKeywords
  ): Promise<ExternalLink[]> {
    log.info('Generating external links for E-E-A-T');

    const prompt = getExternalLinksPrompt(title, content, keywords);
    const response = await this.complete(SYSTEM_PROMPT, prompt, 0.5);
    const parsed = this.parseJSON<{ links: ExternalLink[] }>(response);

    log.info(`Generated ${parsed.links.length} external links`);
    return parsed.links;
  }

  /**
   * Generate article using an external keyword plan and competitor analysis.
   * This avoids the double competitor-analysis that generateArticleEnhanced performs
   * when competitors were already analyzed as a separate pipeline step.
   */
  async generateArticleWithKeywordPlan(
    topic: TrendingTopic,
    keywordPlan: KeywordPlan,
    competitorAnalysis: CompetitorAnalysis
  ): Promise<{
    article: GeneratedArticle;
    uniqueAngle: UniqueAngle;
  }> {
    log.info(`Starting article generation with keyword plan for: ${topic.title}`);

    // Convert KeywordPlan → ArticleKeywords
    const keywords: ArticleKeywords = {
      primary: keywordPlan.primary.keyword,
      secondary: keywordPlan.secondary.map(s => s.keyword),
      lsiKeywords: keywordPlan.longTails.slice(0, 8),
    };

    // Step 1: Generate unique angle (uses existing competitor analysis)
    const uniqueAngle = await this.generateUniqueAngle(topic, competitorAnalysis, keywords);

    // Step 2: Generate outline with angle
    const outline = await this.generateOutlineWithAngle(topic, keywords, uniqueAngle);

    // Step 3: Generate content section-by-section
    const content = await this.generateContentBySection(outline, keywords);

    // Step 4: Generate meta
    const meta = await this.generateMeta(outline.title, content, keywords);

    const wordCount = this.countWords(content);

    log.info('Article generation with keyword plan complete', {
      title: outline.title,
      wordCount,
      primaryKeyword: keywords.primary,
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
