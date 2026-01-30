import { loadConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { TrendsService } from './services/trends.js';
import { OpenAIService } from './services/openai.js';
import { HumanizerService } from './services/humanizer.js';
import { WordPressService } from './services/wordpress.js';
import { UnsplashService } from './services/unsplash.js';
import { ReadabilityService } from './services/readability.js';
import { SchemaService } from './services/schema.js';
import { PipelineResult } from './types/index.js';

const log = logger.child('Pipeline');

/**
 * Simplified article automation pipeline (10 steps, 4-5 API calls)
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

    // Calculate total steps (base: 10, +1 if Unsplash enabled)
    const totalSteps = unsplashService.isEnabled() ? 11 : 10;
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

    // Step 3: Generate keywords
    startStep(3, 'Generating keywords');
    const keywords = await openaiService.generateKeywords(topic);
    log.info('Keywords generated', {
      primary: keywords.primary,
      secondaryCount: keywords.secondary.length,
    });
    endStep('Keyword generation');

    // Step 4: Generate outline
    startStep(4, 'Generating outline');
    const outline = await openaiService.generateOutline(topic, keywords);
    log.info('Outline generated', {
      title: outline.title,
      sectionCount: outline.sections.length,
    });
    endStep('Outline generation');

    // Step 5: Generate article content
    startStep(5, 'Generating article content');
    const content = await openaiService.generateContent(outline, keywords);
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

    // Step 6: Humanize content (single pass)
    startStep(6, 'Humanizing article content');
    const humanizedArticle = await humanizerService.humanizeSinglePass(rawArticle);
    log.info(`Humanized article: ${humanizedArticle.wordCount} words`);
    endStep('Humanization');

    // Step 7: Optimize readability
    startStep(7, 'Optimizing readability');
    const { content: readableContent, initialScore, finalScore } = await readabilityService.enhanceReadability(humanizedArticle.content);
    humanizedArticle.content = readableContent;
    log.info('Readability optimization complete', {
      initialScore: initialScore.fleschReadingEase,
      finalScore: finalScore.fleschReadingEase,
      level: finalScore.readabilityLevel,
    });
    endStep('Readability optimization');

    // Ensure unique slug
    humanizedArticle.slug = await wordpressService.ensureUniqueSlug(
      humanizedArticle.slug
    );

    // Step 8: Fetch featured image (if Unsplash is enabled)
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

    // Step 9: Internal links + Schema markup
    startStep(currentStep + 1, 'Adding internal links and schema');
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

    // Schema markup
    const postUrl = `${config.wordpress.url}/${humanizedArticle.slug}`;
    const articleSchema = schemaService.generateArticleSchema(humanizedArticle, {
      postUrl,
      publishDate: new Date(),
      categoryName: config.wordpress.category,
    });

    const schemas: object[] = [articleSchema];

    const breadcrumbSchema = schemaService.generateBreadcrumbSchema([
      { name: 'Home', url: config.wordpress.url },
      { name: config.wordpress.category, url: `${config.wordpress.url}/category/${config.wordpress.category.toLowerCase().replace(/\s+/g, '-')}` },
      { name: humanizedArticle.title, url: postUrl },
    ]);
    schemas.push(breadcrumbSchema);

    humanizedArticle.content = schemaService.injectMultipleSchemas(humanizedArticle.content, schemas);
    log.info('Schema markup generated and injected', {
      schemaCount: schemas.length,
    });
    endStep('Internal links + schema');

    // Step 10: Publish to WordPress
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
 * Main entry point
 */
async function main(): Promise<void> {
  log.info('='.repeat(60));
  log.info('Article Automation System');
  log.info('='.repeat(60));

  const result = await runWithRetry();

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
