import { promises as fs } from 'fs';
import path from 'path';
import { loadConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { TrendsService } from './services/trends.js';
import { OpenAIService } from './services/openai.js';
import { HumanizerService } from './services/humanizer.js';
import { WordPressService } from './services/wordpress.js';
import { UnsplashService } from './services/unsplash.js';
import { ReadabilityService } from './services/readability.js';
import { SchemaService } from './services/schema.js';
import { PipelineResult, ExternalLink } from './types/index.js';
import { renderFAQSection, generateTableOfContents, injectExternalLinks } from './utils/content.js';

const log = logger.child('Pipeline');

/**
 * Full SEO-optimized article automation pipeline (~19 steps)
 * Includes E-E-A-T signals, competitor analysis, multi-pass humanization,
 * FAQs, Table of Contents, external links, and Grade 7 readability.
 */
async function runPipeline(): Promise<PipelineResult> {
  const startTime = Date.now();
  log.info('Starting article automation pipeline');

  try {
    // Load configuration
    const config = loadConfig();
    log.info('Configuration loaded successfully');

    // Initialize services
    const trendsService = new TrendsService(config.trends, config.openai);
    const openaiService = new OpenAIService(config);
    const humanizerService = new HumanizerService(config);
    const wordpressService = new WordPressService(config);
    const unsplashService = new UnsplashService(config.unsplash);
    const readabilityService = new ReadabilityService(config);
    const schemaService = new SchemaService(config.wordpress);

    // Calculate total steps (base: 18, +1 if Unsplash enabled)
    const totalSteps = unsplashService.isEnabled() ? 19 : 18;
    let currentStep = 0;

    // Step timing helper
    let stepStart = Date.now();
    const stepTimings: Array<{ step: string; duration: string }> = [];

    function startStep(stepNum: number, label: string): void {
      currentStep = stepNum;
      stepStart = Date.now();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log.info(`Step ${stepNum}/${totalSteps}: ${label} [elapsed: ${elapsed}s]`);
    }

    function endStep(label: string): void {
      const dur = ((Date.now() - stepStart) / 1000).toFixed(1);
      stepTimings.push({ step: label, duration: `${dur}s` });
      log.info(`Step ${currentStep} done in ${dur}s`);
    }

    // Step 1: Test WordPress connection
    startStep(1, 'Testing WordPress connection');
    const wpConnected = await wordpressService.testConnection();
    if (!wpConnected) {
      throw new Error('Failed to connect to WordPress');
    }
    endStep('WordPress connection');

    // Step 2: Get trending topic
    startStep(2, 'Discovering trending topic');
    const topic = await trendsService.getTopicForArticle();
    if (!topic) {
      throw new Error('No trending topics found');
    }
    log.info(`Selected topic: ${topic.title}`, {
      relatedQueries: topic.relatedQueries.slice(0, 5),
    });
    endStep('Topic discovery');

    // Step 3: Analyze competitors
    startStep(3, 'Analyzing competitors');
    const competitorAnalysis = await openaiService.analyzeCompetitors(topic);
    log.info('Competitor analysis complete', {
      contentGaps: competitorAnalysis.contentGaps.length,
      averageDepth: competitorAnalysis.averageDepth,
    });
    endStep('Competitor analysis');

    // Step 4: Generate keywords
    startStep(4, 'Generating keywords');
    const keywords = await openaiService.generateKeywords(topic);
    log.info('Keywords generated', {
      primary: keywords.primary,
      secondaryCount: keywords.secondary.length,
    });
    endStep('Keyword generation');

    // Step 5: Generate unique angle
    startStep(5, 'Generating unique angle');
    const uniqueAngle = await openaiService.generateUniqueAngle(topic, competitorAnalysis, keywords);
    log.info('Unique angle generated', {
      angle: uniqueAngle.angle.substring(0, 80),
      targetAudience: uniqueAngle.targetAudience,
    });
    endStep('Unique angle');

    // Step 6: Generate outline (with angle)
    startStep(6, 'Generating outline with unique angle');
    const outline = await openaiService.generateOutlineWithAngle(topic, keywords, uniqueAngle);
    log.info('Outline generated', {
      title: outline.title,
      sectionCount: outline.sections.length,
    });
    endStep('Outline generation');

    // Step 7: Generate article content (section-by-section)
    startStep(7, 'Generating article content section-by-section');
    const content = await openaiService.generateContentBySection(outline, keywords);
    const meta = await openaiService.generateMeta(outline.title, content, keywords);
    const rawWordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
    log.info(`Article generated: ${rawWordCount} words`);
    endStep('Article generation');

    const rawArticle = {
      title: outline.title,
      content,
      slug: meta.slug,
      excerpt: meta.excerpt,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
      keywords,
      wordCount: rawWordCount,
    };

    // Step 8: Generate FAQs
    startStep(8, 'Generating FAQ content');
    const faqs = await openaiService.generateFAQs(outline.title, content, keywords);
    log.info(`Generated ${faqs.length} FAQ items`);
    endStep('FAQ generation');

    // Step 9: Humanize content (full multi-pass)
    startStep(9, 'Humanizing article content (multi-pass)');
    const humanizedArticle = await humanizerService.humanizeArticle(rawArticle);
    log.info(`Humanized article: ${humanizedArticle.wordCount} words`);
    endStep('Humanization');

    // Step 10: Enhance originality
    startStep(10, 'Enhancing originality');
    const { content: originalContent, originalityCheck, improved: originalityImproved } =
      await humanizerService.enhanceOriginality(humanizedArticle.content);
    humanizedArticle.content = originalContent;
    log.info('Originality enhancement complete', {
      score: originalityCheck.overallScore,
      improved: originalityImproved,
    });
    endStep('Originality enhancement');

    // Step 11: Optimize readability (Grade 7 target, FRE >= 70)
    startStep(11, 'Optimizing readability (Grade 7 target)');
    const { content: readableContent, initialScore, finalScore } =
      await readabilityService.enhanceReadability(humanizedArticle.content);
    humanizedArticle.content = readableContent;
    log.info('Readability optimization complete', {
      initialScore: initialScore.fleschReadingEase,
      finalScore: finalScore.fleschReadingEase,
      level: finalScore.readabilityLevel,
    });
    endStep('Readability optimization');

    // Step 12: Generate external links
    startStep(12, 'Generating external links');
    let externalLinks: ExternalLink[];
    try {
      externalLinks = await openaiService.generateExternalLinks(
        humanizedArticle.title,
        humanizedArticle.content,
        humanizedArticle.keywords
      );
      log.info(`Generated ${externalLinks.length} external links`);
    } catch (extLinkError) {
      log.warn('Failed to generate external links, continuing without', extLinkError);
      externalLinks = [];
    }
    endStep('External link generation');

    // Step 13: Inject FAQ section into content
    startStep(13, 'Injecting FAQ section');
    const faqHtml = renderFAQSection(faqs);
    if (faqHtml) {
      humanizedArticle.content = humanizedArticle.content + '\n\n' + faqHtml;
      log.info('FAQ section injected');
    }
    endStep('FAQ injection');

    // Step 14: Inject Table of Contents
    startStep(14, 'Injecting Table of Contents');
    const { tocHtml, contentWithIds } = generateTableOfContents(humanizedArticle.content);
    if (tocHtml) {
      // Insert TOC after the first paragraph
      const firstPEnd = contentWithIds.indexOf('</p>');
      if (firstPEnd !== -1) {
        humanizedArticle.content =
          contentWithIds.slice(0, firstPEnd + 4) +
          '\n\n' + tocHtml + '\n\n' +
          contentWithIds.slice(firstPEnd + 4);
      } else {
        humanizedArticle.content = tocHtml + '\n\n' + contentWithIds;
      }
      log.info('Table of Contents injected');
    } else {
      humanizedArticle.content = contentWithIds;
    }
    endStep('TOC injection');

    // Step 15: Inject external links
    startStep(15, 'Injecting external links');
    if (externalLinks.length > 0) {
      humanizedArticle.content = injectExternalLinks(humanizedArticle.content, externalLinks);
      log.info(`Injected ${externalLinks.length} external links`);
    }
    endStep('External link injection');

    // Ensure unique slug
    humanizedArticle.slug = await wordpressService.ensureUniqueSlug(
      humanizedArticle.slug
    );

    // Step 16: Fetch featured image (if Unsplash is enabled)
    let featuredMediaId: number | undefined;
    if (unsplashService.isEnabled()) {
      startStep(currentStep + 1, 'Fetching featured image');
      try {
        const imageData = await unsplashService.getFeaturedImage(
          humanizedArticle.keywords.primary,
          topic.title
        );

        if (imageData) {
          const altText = `${humanizedArticle.keywords.primary} - ${humanizedArticle.title}`;
          const caption = `Photo by ${imageData.photographer} on Unsplash`;
          const media = await wordpressService.uploadMedia(
            imageData.buffer,
            imageData.filename,
            imageData.mimeType,
            altText,
            caption
          );

          featuredMediaId = media.id;

          humanizedArticle.featuredImage = {
            url: media.url,
            photographer: imageData.photographer,
            photographerUrl: imageData.photographerUrl,
          };

          log.info('Featured image uploaded successfully', {
            photographer: imageData.photographer,
            mediaId: media.id,
            altText,
          });
        } else {
          log.warn('No suitable featured image found, continuing without');
        }
      } catch (imageError) {
        log.warn('Failed to fetch featured image, continuing without', imageError);
      }
      endStep('Featured image');
    }

    // Step 17: Add internal links
    startStep(currentStep + 1, 'Adding internal links');
    try {
      const linkKeywords = [
        humanizedArticle.keywords.primary,
        ...humanizedArticle.keywords.secondary,
        ...humanizedArticle.keywords.lsiKeywords.slice(0, 3),
      ];

      const relatedPosts = await wordpressService.getRelatedPosts(linkKeywords, humanizedArticle.slug);

      if (relatedPosts.length > 0) {
        humanizedArticle.content = wordpressService.injectInternalLinks(
          humanizedArticle.content,
          relatedPosts,
          5
        );
        log.info(`Added links to ${Math.min(relatedPosts.length, 5)} related posts`);
      } else {
        log.info('No related posts found for internal linking');
      }
    } catch (linkError) {
      log.warn('Failed to add internal links, continuing without', linkError);
    }
    endStep('Internal links');

    // Step 18: Generate schema (Article + FAQ + Breadcrumb)
    startStep(currentStep + 1, 'Generating schema markup');
    const postUrl = `${config.wordpress.url}/${humanizedArticle.slug}`;
    const articleSchema = schemaService.generateArticleSchema(humanizedArticle, {
      postUrl,
      publishDate: new Date(),
      categoryName: config.wordpress.category,
    });

    const schemas: object[] = [articleSchema];

    // FAQ schema
    if (faqs.length > 0) {
      const faqSchema = schemaService.generateFAQSchema(faqs);
      schemas.push(faqSchema);
      log.info('FAQ schema generated');
    }

    // Breadcrumb schema
    const breadcrumbSchema = schemaService.generateBreadcrumbSchema([
      { name: 'Home', url: config.wordpress.url },
      { name: config.wordpress.category, url: `${config.wordpress.url}/category/${config.wordpress.category.toLowerCase().replace(/\s+/g, '-')}` },
      { name: humanizedArticle.title, url: postUrl },
    ]);
    schemas.push(breadcrumbSchema);

    humanizedArticle.content = schemaService.injectMultipleSchemas(humanizedArticle.content, schemas);
    log.info('Schema markup generated and injected', {
      schemaCount: schemas.length,
      types: ['Article', ...(faqs.length > 0 ? ['FAQPage'] : []), 'BreadcrumbList'],
    });
    endStep('Schema markup');

    // Step 19: Publish to WordPress
    startStep(currentStep + 1, 'Publishing to WordPress');
    const post = await wordpressService.publishArticle(humanizedArticle, {
      featuredMediaId,
    });
    endStep('WordPress publish');

    const duration = Date.now() - startTime;
    const tokenUsage = openaiService.getTokenUsage();

    // Log step timing breakdown
    log.info('Step durations:');
    for (const t of stepTimings) {
      log.info(`  ${t.step}: ${t.duration}`);
    }

    log.info('Pipeline completed successfully', {
      totalDuration: `${(duration / 1000).toFixed(1)}s`,
      postId: post.id,
      postUrl: post.link,
      totalTokens: tokenUsage.totalTokens,
      hasFeaturedImage: !!humanizedArticle.featuredImage,
      readabilityScore: finalScore.fleschReadingEase,
      faqCount: faqs.length,
      externalLinks: externalLinks.length,
      originalityScore: originalityCheck.overallScore,
    });

    return {
      success: true,
      topic,
      article: humanizedArticle,
      postUrl: post.link,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Pipeline failed', {
      duration: `${(duration / 1000).toFixed(1)}s`,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Run with retry logic
 */
async function runWithRetry(maxRetries: number = 3): Promise<PipelineResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log.info(`Attempt ${attempt}/${maxRetries}`);

    const result = await runPipeline();

    if (result.success) {
      return result;
    }

    lastError = result.error;

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      log.info(`Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} attempts. Last error: ${lastError}`,
  };
}

/**
 * Save pipeline result to history.json so the dashboard can display it
 */
async function saveToHistory(result: PipelineResult, startTime: Date): Promise<void> {
  try {
    const historyPath = path.join(process.cwd(), 'data', 'history.json');

    await fs.mkdir(path.dirname(historyPath), { recursive: true });

    let history: Record<string, unknown>[] = [];
    try {
      const data = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      topic: result.topic?.title || 'Unknown',
      title: result.article?.title || '',
      slug: result.article?.slug || '',
      wordCount: result.article?.wordCount || 0,
      status: result.success ? 'published' as const : 'failed' as const,
      postUrl: result.postUrl,
      error: result.error,
      createdAt: startTime.toISOString(),
      completedAt: new Date().toISOString(),
    };

    history.unshift(record);
    if (history.length > 100) {
      history.splice(100);
    }

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    log.info('Article saved to history');
  } catch (err) {
    log.warn('Failed to save to history', err);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  log.info('='.repeat(60));
  log.info('Article Automation System');
  log.info('='.repeat(60));

  const startTime = new Date();
  const result = await runWithRetry();

  await saveToHistory(result, startTime);

  if (result.success) {
    log.info('='.repeat(60));
    log.info('SUCCESS');
    log.info(`Topic: ${result.topic?.title}`);
    log.info(`Article: ${result.article?.title}`);
    log.info(`Published: ${result.postUrl}`);
    log.info('='.repeat(60));
    process.exit(0);
  } else {
    log.error('='.repeat(60));
    log.error('FAILED');
    log.error(`Error: ${result.error}`);
    log.error('='.repeat(60));
    process.exit(1);
  }
}

// Run if executed directly
main().catch((error) => {
  log.error('Unexpected error', error);
  process.exit(1);
});

export { runPipeline, runWithRetry };
