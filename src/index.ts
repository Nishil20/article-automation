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
 * Enhanced article automation pipeline with originality and SEO improvements
 */
async function runPipeline(): Promise<PipelineResult> {
  const startTime = Date.now();
  log.info('Starting ENHANCED article automation pipeline');

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

    // Calculate total steps (base: 11, +1 if Unsplash enabled)
    const totalSteps = unsplashService.isEnabled() ? 12 : 11;
    let currentStep = 0;

    // Step 1: Test WordPress connection
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Testing WordPress connection`);
    const wpConnected = await wordpressService.testConnection();
    if (!wpConnected) {
      throw new Error('Failed to connect to WordPress');
    }

    // Step 2: Get trending topic
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Discovering trending topic`);
    const topic = await trendsService.getTopicForArticle();
    if (!topic) {
      throw new Error('No trending topics found');
    }
    log.info(`Selected topic: ${topic.title}`, {
      relatedQueries: topic.relatedQueries.slice(0, 5),
    });

    // Step 3: Analyze competitors (NEW)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Analyzing competitors`);
    const competitorAnalysis = await openaiService.analyzeCompetitors(topic);
    log.info('Competitor analysis complete', {
      contentGaps: competitorAnalysis.contentGaps.length,
      uniqueOpportunities: competitorAnalysis.uniqueOpportunities.length,
    });

    // Step 4: Generate article with unique angle (ENHANCED)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Generating article with unique angle`);
    const { article: rawArticle, uniqueAngle } = await openaiService.generateArticleEnhanced(topic);
    log.info(`Raw article generated: ${rawArticle.wordCount} words`, {
      uniqueAngle: uniqueAngle.angle.substring(0, 80) + '...',
    });

    // Step 5: Check and improve originality (NEW)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Checking and improving originality`);
    const { content: originalContent, originalityCheck } = await humanizerService.enhanceOriginality(rawArticle.content);
    rawArticle.content = originalContent;
    log.info('Originality check complete', {
      score: originalityCheck.overallScore,
      genericPhrasesFound: originalityCheck.genericPhrases.length,
    });

    // Step 6: Humanize article
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Humanizing article content`);
    let humanizedArticle = await humanizerService.humanizeArticle(rawArticle);
    log.info(`Humanized article: ${humanizedArticle.wordCount} words`);

    // Step 7: Optimize readability (NEW)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Optimizing readability`);
    const { content: readableContent, initialScore, finalScore } = await readabilityService.enhanceReadability(humanizedArticle.content);
    humanizedArticle.content = readableContent;
    log.info('Readability optimization complete', {
      initialScore: initialScore.fleschReadingEase,
      finalScore: finalScore.fleschReadingEase,
      level: finalScore.readabilityLevel,
    });

    // Ensure unique slug
    humanizedArticle.slug = await wordpressService.ensureUniqueSlug(
      humanizedArticle.slug
    );

    // Step 8: Fetch featured image (if Unsplash is enabled)
    let featuredMediaId: number | undefined;
    if (unsplashService.isEnabled()) {
      currentStep++;
      log.info(`Step ${currentStep}/${totalSteps}: Fetching featured image`);
      try {
        const imageData = await unsplashService.getFeaturedImage(
          humanizedArticle.keywords.primary,
          topic.title
        );

        if (imageData) {
          // Upload to WordPress
          const media = await wordpressService.uploadMedia(
            imageData.buffer,
            imageData.filename,
            imageData.mimeType
          );

          featuredMediaId = media.id;

          // Store attribution info in the article
          humanizedArticle.featuredImage = {
            url: media.url,
            photographer: imageData.photographer,
            photographerUrl: imageData.photographerUrl,
          };

          log.info('Featured image uploaded successfully', {
            photographer: imageData.photographer,
            mediaId: media.id,
          });
        } else {
          log.warn('No suitable featured image found, continuing without');
        }
      } catch (imageError) {
        // Non-critical failure - continue with publishing
        log.warn('Failed to fetch featured image, continuing without', imageError);
      }
    }

    // Step 9: Add internal links (NEW)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Adding internal links`);
    try {
      const keywords = [
        humanizedArticle.keywords.primary,
        ...humanizedArticle.keywords.secondary.slice(0, 2),
      ];
      const relatedPosts = await wordpressService.getRelatedPosts(keywords, humanizedArticle.slug);
      if (relatedPosts.length > 0) {
        humanizedArticle.content = wordpressService.injectInternalLinks(
          humanizedArticle.content,
          relatedPosts,
          3
        );
        log.info(`Added links to ${relatedPosts.length} related posts`);
      } else {
        log.info('No related posts found for internal linking');
      }
    } catch (linkError) {
      log.warn('Failed to add internal links, continuing without', linkError);
    }

    // Step 10: Generate schema markup (NEW)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Generating schema markup`);
    // Note: We'll add schema after getting the post URL from WordPress
    const schemaPlaceholder = schemaService.generateArticleSchema(humanizedArticle, {
      postUrl: `${config.wordpress.url}/${humanizedArticle.slug}`, // Placeholder URL
      publishDate: new Date(),
      categoryName: config.wordpress.category,
    });
    log.info('Schema markup generated', {
      type: schemaPlaceholder['@type'],
      hasImage: !!schemaPlaceholder.image,
    });

    // Step 11: Publish to WordPress
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Publishing to WordPress`);
    const post = await wordpressService.publishArticle(humanizedArticle, {
      featuredMediaId,
    });

    // Update schema with actual post URL
    const finalSchema = schemaService.generateArticleSchema(humanizedArticle, {
      postUrl: post.link,
      publishDate: new Date(),
      categoryName: config.wordpress.category,
    });

    // Validate the schema
    const schemaValidation = schemaService.validateSchema(finalSchema);
    if (!schemaValidation.valid) {
      log.warn('Schema validation issues', { errors: schemaValidation.errors });
    }

    const duration = Date.now() - startTime;
    const tokenUsage = openaiService.getTokenUsage();

    log.info('Enhanced pipeline completed successfully', {
      duration: `${(duration / 1000).toFixed(1)}s`,
      postId: post.id,
      postUrl: post.link,
      totalTokens: tokenUsage.totalTokens,
      hasFeaturedImage: !!humanizedArticle.featuredImage,
      readabilityScore: finalScore.fleschReadingEase,
      originalityScore: originalityCheck.overallScore,
      uniqueAngle: uniqueAngle.angle.substring(0, 50) + '...',
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
