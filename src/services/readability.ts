import OpenAI from 'openai';
import { Config, ReadabilityScore } from '../types/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child('Readability');

export class ReadabilityService {
  private client: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      maxRetries: 5,
    });
    this.model = config.openai.model;
  }

  /**
   * Count syllables in a word using a simple algorithm
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;

    // Remove silent e at the end
    word = word.replace(/(?:[^leas]es|ed|[^aeiou]e)$/, '');
    word = word.replace(/^y/, '');

    // Count vowel groups
    const matches = word.match(/[aeiouy]+/g);
    return matches ? matches.length : 1;
  }

  /**
   * Extract plain text from HTML content
   */
  private extractText(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split text into sentences
   */
  private getSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Get words from text
   */
  private getWords(text: string): string[] {
    return text
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z]/g, ''))
      .filter(w => w.length > 0);
  }

  /**
   * Calculate Flesch-Kincaid Grade Level
   * Lower scores = easier to read
   * Target: 7-8 (easily readable by 13-14 year olds)
   */
  private calculateFleschKincaidGrade(
    totalWords: number,
    totalSentences: number,
    totalSyllables: number
  ): number {
    if (totalSentences === 0 || totalWords === 0) return 0;

    const avgSentenceLength = totalWords / totalSentences;
    const avgSyllablesPerWord = totalSyllables / totalWords;

    // Flesch-Kincaid Grade Level formula
    return 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
  }

  /**
   * Calculate Flesch Reading Ease score
   * Higher scores = easier to read
   * 70-80 is the target range (Grade 7, easily understood by 12-13 year olds)
   */
  private calculateFleschReadingEase(
    totalWords: number,
    totalSentences: number,
    totalSyllables: number
  ): number {
    if (totalSentences === 0 || totalWords === 0) return 0;

    const avgSentenceLength = totalWords / totalSentences;
    const avgSyllablesPerWord = totalSyllables / totalWords;

    // Flesch Reading Ease formula
    return 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
  }

  /**
   * Determine readability level from Flesch Reading Ease score
   */
  private getReadabilityLevel(fleschReadingEase: number): ReadabilityScore['readabilityLevel'] {
    if (fleschReadingEase >= 80) return 'very_easy';
    if (fleschReadingEase >= 60) return 'easy';
    if (fleschReadingEase >= 40) return 'standard';
    if (fleschReadingEase >= 20) return 'difficult';
    return 'very_difficult';
  }

  /**
   * Generate suggestions based on readability analysis
   */
  private generateSuggestions(
    avgSentenceLength: number,
    avgSyllablesPerWord: number,
    fleschReadingEase: number
  ): string[] {
    const suggestions: string[] = [];

    if (avgSentenceLength > 20) {
      suggestions.push(
        `Shorten sentences - average is ${avgSentenceLength.toFixed(1)} words, aim for 15-20`
      );
    }

    if (avgSyllablesPerWord > 1.7) {
      suggestions.push(
        `Use simpler words - average syllables per word is ${avgSyllablesPerWord.toFixed(2)}, aim for 1.5`
      );
    }

    if (fleschReadingEase < 60) {
      suggestions.push('Break up complex paragraphs into shorter, focused sections');
      suggestions.push('Replace jargon and technical terms with simpler alternatives');
    }

    if (fleschReadingEase < 50) {
      suggestions.push('Add more short sentences to create rhythm and improve flow');
      suggestions.push('Use bullet points or lists where appropriate');
    }

    if (suggestions.length === 0) {
      suggestions.push('Content readability is good - no major changes needed');
    }

    return suggestions;
  }

  /**
   * Analyze content readability
   */
  analyzeReadability(htmlContent: string): ReadabilityScore {
    log.info('Analyzing content readability');

    const text = this.extractText(htmlContent);
    const sentences = this.getSentences(text);
    const words = this.getWords(text);

    const totalWords = words.length;
    const totalSentences = sentences.length;
    const totalSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);

    const avgSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;
    const avgSyllablesPerWord = totalWords > 0 ? totalSyllables / totalWords : 0;

    const fleschKincaid = this.calculateFleschKincaidGrade(totalWords, totalSentences, totalSyllables);
    const fleschReadingEase = this.calculateFleschReadingEase(totalWords, totalSentences, totalSyllables);
    const readabilityLevel = this.getReadabilityLevel(fleschReadingEase);
    const suggestions = this.generateSuggestions(avgSentenceLength, avgSyllablesPerWord, fleschReadingEase);

    const score: ReadabilityScore = {
      fleschKincaid: Math.max(0, Math.round(fleschKincaid * 10) / 10),
      fleschReadingEase: Math.max(0, Math.min(100, Math.round(fleschReadingEase * 10) / 10)),
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
      readabilityLevel,
      suggestions,
    };

    log.info('Readability analysis complete', {
      fleschReadingEase: score.fleschReadingEase,
      fleschKincaid: score.fleschKincaid,
      readabilityLevel: score.readabilityLevel,
      wordCount: totalWords,
      sentenceCount: totalSentences,
    });

    return score;
  }

  /**
   * Make a completion request for content optimization
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
   * Optimize content for better readability
   */
  async optimizeReadability(
    htmlContent: string,
    currentScore: ReadabilityScore
  ): Promise<string> {
    // Skip if readability is already good (Grade 7 target: FRE >= 70)
    if (currentScore.fleschReadingEase >= 70) {
      log.info('Readability is good, skipping optimization');
      return htmlContent;
    }

    log.info('Optimizing content readability', {
      currentScore: currentScore.fleschReadingEase,
      targetScore: 70,
    });

    const systemPrompt = `You are an expert editor specializing in improving content readability.
Your goal is to make content easier to read while maintaining meaning and SEO value.`;

    const userPrompt = `Improve the readability of this content.

CURRENT READABILITY METRICS:
- Flesch Reading Ease: ${currentScore.fleschReadingEase} (target: 70-80)
- Average sentence length: ${currentScore.avgSentenceLength} words (target: 15-20)
- Average syllables per word: ${currentScore.avgSyllablesPerWord} (target: ~1.5)

ISSUES TO ADDRESS:
${currentScore.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

CONTENT TO IMPROVE:
${htmlContent}

INSTRUCTIONS:
1. Break long sentences into shorter ones (aim for 15-20 words per sentence)
2. Replace complex words with simpler alternatives where possible
3. Add variety in sentence length (mix short and medium sentences)
4. Keep all HTML structure intact (<h2>, <h3>, <p>, <ul>, <li>, <strong>)
5. Preserve SEO keywords and important terms
6. Maintain the same overall meaning and information

Output the improved HTML content only. Do NOT wrap in markdown code blocks.`;

    const optimizedContent = await this.complete(systemPrompt, userPrompt, 0.6);
    return this.stripCodeBlocks(optimizedContent);
  }

  /**
   * Full readability enhancement pipeline
   */
  async enhanceReadability(htmlContent: string): Promise<{
    content: string;
    initialScore: ReadabilityScore;
    finalScore: ReadabilityScore;
    optimized: boolean;
  }> {
    // Analyze initial readability
    const initialScore = this.analyzeReadability(htmlContent);

    // Optimize if needed (Grade 7 target: FRE >= 70)
    if (initialScore.fleschReadingEase < 70) {
      const optimizedContent = await this.optimizeReadability(htmlContent, initialScore);
      const finalScore = this.analyzeReadability(optimizedContent);

      log.info('Readability enhancement complete', {
        initialScore: initialScore.fleschReadingEase,
        finalScore: finalScore.fleschReadingEase,
        improvement: finalScore.fleschReadingEase - initialScore.fleschReadingEase,
      });

      return {
        content: optimizedContent,
        initialScore,
        finalScore,
        optimized: true,
      };
    }

    return {
      content: htmlContent,
      initialScore,
      finalScore: initialScore,
      optimized: false,
    };
  }
}
