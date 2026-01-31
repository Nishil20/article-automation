import OpenAI from 'openai';
import { Config, VoiceConfig, GeneratedArticle, OriginalityCheck } from '../types/index.js';
import {
  getHumanizationPrompt,
  getAIPatternAnalysisPrompt,
  getFinalPolishPrompt,
  WORD_REPLACEMENTS,
} from '../prompts/humanize.js';
import {
  getOriginalityCheckPrompt,
  getOriginalityImprovementPrompt,
} from '../prompts/article.js';
import { logger } from '../utils/logger.js';

const log = logger.child('Humanizer');

interface AIPatternAnalysis {
  roboticWords: string[];
  uniformSentences: string[];
  repetitiveStructures: string[];
  missingElements: string[];
  artificialTransitions: string[];
  overallScore: number;
  suggestions: string[];
}

export class HumanizerService {
  private client: OpenAI;
  private model: string;
  private voiceConfig: VoiceConfig;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      maxRetries: 5,
    });
    this.model = config.openai.model;
    this.voiceConfig = config.voice;
  }

  /**
   * Make a completion request
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

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    return content;
  }

  /**
   * Analyze content for AI patterns
   */
  async analyzePatterns(content: string): Promise<AIPatternAnalysis> {
    log.info('Analyzing content for AI patterns');

    const systemPrompt = 'You are an expert at detecting AI-generated content patterns.';
    const response = await this.complete(
      systemPrompt,
      getAIPatternAnalysisPrompt(content),
      0.3
    );

    // Parse JSON response
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    try {
      const analysis = JSON.parse(cleaned.trim()) as AIPatternAnalysis;
      log.info('Pattern analysis complete', {
        score: analysis.overallScore,
        roboticWordsCount: analysis.roboticWords.length,
      });
      return analysis;
    } catch {
      log.warn('Failed to parse pattern analysis, using defaults');
      return {
        roboticWords: [],
        uniformSentences: [],
        repetitiveStructures: [],
        missingElements: [],
        artificialTransitions: [],
        overallScore: 5,
        suggestions: [],
      };
    }
  }

  /**
   * Quick word replacement pass (non-AI, deterministic)
   */
  quickWordReplacement(content: string): string {
    log.info('Performing quick word replacements');
    
    let result = content;
    let replacementCount = 0;

    for (const [word, alternatives] of Object.entries(WORD_REPLACEMENTS)) {
      // Create regex for whole word matching (case insensitive)
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      
      if (regex.test(result)) {
        // Pick a random alternative
        const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
        result = result.replace(regex, (match) => {
          replacementCount++;
          // Preserve original capitalization
          if (match[0] === match[0].toUpperCase()) {
            return replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }
          return replacement;
        });
      }
    }

    log.info(`Replaced ${replacementCount} robotic words`);
    return result;
  }

  /**
   * Calculate sentence length variance (burstiness metric)
   */
  analyzeBurstiness(content: string): { score: number; avgLength: number; variance: number } {
    // Extract text content from HTML
    const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Split into sentences
    const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length < 2) {
      return { score: 0, avgLength: 0, variance: 0 };
    }

    // Calculate word counts per sentence
    const wordCounts = sentences.map(s => s.trim().split(/\s+/).length);
    
    // Calculate average
    const avgLength = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    
    // Calculate variance
    const variance = wordCounts.reduce((sum, count) => {
      return sum + Math.pow(count - avgLength, 2);
    }, 0) / wordCounts.length;
    
    // Calculate burstiness score (0-10, higher is more varied/human-like)
    // Human writing typically has variance of 50-150, AI tends to be 20-50
    const score = Math.min(10, Math.max(0, (Math.sqrt(variance) / avgLength) * 10));

    log.info('Burstiness analysis', { score: score.toFixed(2), avgLength: avgLength.toFixed(1), variance: variance.toFixed(1) });
    
    return { score, avgLength, variance };
  }

  /**
   * Main humanization pass using AI
   */
  async humanize(content: string): Promise<string> {
    log.info('Starting AI humanization pass');

    const systemPrompt = `You are an expert editor specializing in making AI-generated content 
sound natural and human-written. You have a keen eye for robotic patterns and know exactly 
how to transform them into engaging, authentic prose.`;

    const humanizedContent = await this.complete(
      systemPrompt,
      getHumanizationPrompt(content, this.voiceConfig),
      0.8 // Higher temperature for more creative variation
    );

    return humanizedContent;
  }

  /**
   * Final polish pass
   */
  async polish(content: string): Promise<string> {
    log.info('Applying final polish');

    const systemPrompt = 'You are a meticulous editor doing a final review pass.';
    const polishedContent = await this.complete(
      systemPrompt,
      getFinalPolishPrompt(content),
      0.5
    );

    return polishedContent;
  }

  /**
   * Strip markdown code blocks from content
   */
  private stripCodeBlocks(content: string): string {
    let cleaned = content.trim();
    const codeBlockStartRegex = /^`{3,}\s*(?:html|json|javascript|css|xml|markdown|md)?\s*\n?/i;
    cleaned = cleaned.replace(codeBlockStartRegex, '');
    const codeBlockEndRegex = /\n?`{3,}\s*$/;
    cleaned = cleaned.replace(codeBlockEndRegex, '');
    cleaned = cleaned.replace(/^\s*`{3,}\s*$/gm, '');
    return cleaned.trim();
  }

  /**
   * Check content for originality issues
   */
  async checkOriginality(content: string): Promise<OriginalityCheck> {
    log.info('Checking content originality');

    const systemPrompt = 'You are an expert editor analyzing content for originality and uniqueness.';
    const response = await this.complete(
      systemPrompt,
      getOriginalityCheckPrompt(content),
      0.3
    );

    // Parse JSON response
    let cleaned = this.stripCodeBlocks(response);

    try {
      const check = JSON.parse(cleaned) as OriginalityCheck;
      log.info('Originality check complete', {
        score: check.overallScore,
        genericPhrasesCount: check.genericPhrases.length,
        clichesCount: check.cliches.length,
      });
      return check;
    } catch {
      log.warn('Failed to parse originality check, using defaults');
      return {
        overallScore: 70,
        genericPhrases: [],
        cliches: [],
        uniqueElements: [],
        suggestions: [],
      };
    }
  }

  /**
   * Improve content originality based on check results
   */
  async improveOriginality(
    content: string,
    originalityCheck: OriginalityCheck
  ): Promise<string> {
    // Skip if originality is already good
    if (originalityCheck.overallScore >= 80) {
      log.info('Originality score is good, skipping improvement');
      return content;
    }

    log.info('Improving content originality', {
      currentScore: originalityCheck.overallScore,
      genericPhrasesToFix: originalityCheck.genericPhrases.length,
      clichesToFix: originalityCheck.cliches.length,
    });

    const systemPrompt = `You are an expert editor improving content originality.
Your goal is to replace generic phrases and clichés with fresh, unique language
while maintaining the same meaning and HTML structure.`;

    const improvedContent = await this.complete(
      systemPrompt,
      getOriginalityImprovementPrompt(
        content,
        originalityCheck.genericPhrases,
        originalityCheck.cliches,
        originalityCheck.suggestions
      ),
      0.75
    );

    // Strip any code blocks the AI might have added
    return this.stripCodeBlocks(improvedContent);
  }

  /**
   * Full originality enhancement pipeline
   */
  async enhanceOriginality(content: string): Promise<{
    content: string;
    originalityCheck: OriginalityCheck;
    improved: boolean;
  }> {
    // Check originality
    const originalityCheck = await this.checkOriginality(content);

    // Improve if needed
    if (originalityCheck.overallScore < 80) {
      const improvedContent = await this.improveOriginality(content, originalityCheck);
      
      // Re-check to verify improvement
      const finalCheck = await this.checkOriginality(improvedContent);
      
      log.info('Originality enhancement complete', {
        initialScore: originalityCheck.overallScore,
        finalScore: finalCheck.overallScore,
        improved: finalCheck.overallScore > originalityCheck.overallScore,
      });

      return {
        content: improvedContent,
        originalityCheck: finalCheck,
        improved: true,
      };
    }

    return {
      content,
      originalityCheck,
      improved: false,
    };
  }

  /**
   * Single-pass humanization: word replacement (local) + one AI humanize call.
   * Much faster than the full humanizeArticle() pipeline.
   */
  async humanizeSinglePass(article: GeneratedArticle): Promise<GeneratedArticle> {
    log.info(`Starting single-pass humanization for: ${article.title}`);

    // Step 1: Quick deterministic word replacements (local, no API call)
    let content = this.quickWordReplacement(article.content);

    // Step 2: Single AI humanization pass (1 API call)
    content = await this.humanize(content);

    // Step 3: Strip any code blocks the AI might have wrapped around the HTML
    content = this.stripCodeBlocks(content);

    const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;

    log.info(`Single-pass humanization complete: ${wordCount} words`);

    return {
      ...article,
      content,
      wordCount,
    };
  }

  /**
   * Full humanization pipeline
   */
  async humanizeArticle(article: GeneratedArticle): Promise<GeneratedArticle> {
    log.info(`Starting humanization pipeline for: ${article.title}`);

    // Step 1: Analyze current state
    const initialAnalysis = await this.analyzePatterns(article.content);
    log.info(`Initial AI score: ${initialAnalysis.overallScore}/10 (lower = more AI-like)`);

    // Step 2: Quick deterministic replacements
    let content = this.quickWordReplacement(article.content);

    // Step 3: Check burstiness
    const burstiness = this.analyzeBurstiness(content);
    
    // Step 4: Main humanization pass
    content = await this.humanize(content);

    // Step 5: Check if we need more work
    const midAnalysis = await this.analyzePatterns(content);
    
    if (midAnalysis.overallScore < 7) {
      log.info('Score still low, applying additional humanization');
      content = await this.humanize(content);
    }

    // Step 6: Final polish
    content = await this.polish(content);

    // Final analysis
    const finalAnalysis = await this.analyzePatterns(content);
    const finalBurstiness = this.analyzeBurstiness(content);

    log.info('Humanization complete', {
      initialScore: initialAnalysis.overallScore,
      finalScore: finalAnalysis.overallScore,
      burstinessImprovement: `${burstiness.score.toFixed(1)} -> ${finalBurstiness.score.toFixed(1)}`,
    });

    // Update word count
    const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;

    return {
      ...article,
      content,
      wordCount,
    };
  }
}
