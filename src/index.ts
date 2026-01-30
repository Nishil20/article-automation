import { loadConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { TrendsService } from './services/trends.js';
import { OpenAIService } from './services/openai.js';
import { HumanizerService } from './services/humanizer.js';
import { WordPressService } from './services/wordpress.js';
import { UnsplashService } from './services/unsplash.js';
import { ReadabilityService } from './services/readability.js';
import { SchemaService } from './services/schema.js';
import { TopicClusterService } from './services/topic-cluster.js';
import { KeywordResearchService } from './services/keyword-research.js';
import { PipelineResult } from './types/index.js';
import { renderFAQSection, generateTableOfContents } from './utils/content.js';

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
    const clusterService = new TopicClusterService({ apiKey: config.openai.apiKey });
    const keywordService = new KeywordResearchService(config);

    // Calculate total steps (base: 19, +1 if Unsplash enabled)
    const totalSteps = unsplashService.isEnabled() ? 20 : 19;
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

    // Step 3: Classify topic cluster (with embeddings, falls back to Jaccard)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Classifying topic cluster`);
    let clusterResult;
    try {
      clusterResult = await clusterService.classifyTopicWithEmbeddings(topic.title, topic.relatedQueries);
    } catch (clusterError) {
      log.warn('Embedding classification failed, falling back to keyword matching', clusterError);
      clusterResult = clusterService.classifyTopic(topic.title, topic.relatedQueries);
    }
    log.info('Topic cluster classification', {
      clusterId: clusterResult.clusterId,
      contentType: clusterResult.contentType,
      isNewCluster: clusterResult.isNew,
    });

    // Step 4: Research keywords
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Researching keywords`);
    const keywordCandidates = await keywordService.researchKeywords(topic.title, topic.relatedQueries);
    log.info(`Keyword research complete: ${keywordCandidates.length} candidates`);

    // Step 5: Check keyword cannibalization (non-critical)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Checking keyword cannibalization`);
    let cannibalizationResults;
    try {
      cannibalizationResults = await keywordService.checkCannibalization(keywordCandidates);
      const cannibalizedCount = cannibalizationResults.filter(r => r.isCannibalized).length;
      log.info(`Cannibalization check: ${cannibalizedCount} overlapping keywords found`);
    } catch (cannError) {
      log.warn('Cannibalization check failed, continuing without', cannError);
      cannibalizationResults = keywordCandidates.map(c => ({
        keyword: c.keyword,
        overlappingArticles: [] as Array<{ title: string; slug: string; similarity: number; matchedKeywords: string[] }>,
        isCannibalized: false,
        suggestedLongTails: [] as string[],
      }));
    }

    // Step 6: Classify search intent (non-critical)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Classifying search intent`);
    let classifiedKeywords;
    try {
      classifiedKeywords = await keywordService.classifyIntent(keywordCandidates);
      log.info('Search intent classification complete');
    } catch (intentError) {
      log.warn('Intent classification failed, defaulting to informational', intentError);
      classifiedKeywords = keywordCandidates;
    }

    // Step 7: Score and prioritize keywords (critical gate)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Scoring and prioritizing keywords`);
    const keywordPlan = keywordService.scoreAndPrioritize(classifiedKeywords, cannibalizationResults);
    log.info(`Keyword plan: primary="${keywordPlan.primary.keyword}" (score: ${keywordPlan.score.toFixed(1)})`);

    // Expand long-tails (non-critical)
    try {
      keywordPlan.longTails = await keywordService.expandLongTails(keywordPlan.primary.keyword);
      log.info(`Expanded ${keywordPlan.longTails.length} long-tail keywords`);
    } catch (ltError) {
      log.warn('Long-tail expansion failed, continuing without', ltError);
      keywordPlan.longTails = [];
    }

    // Step 8: Analyze competitors
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Analyzing competitors`);
    const competitorAnalysis = await openaiService.analyzeCompetitors(topic);
    log.info('Competitor analysis complete', {
      contentGaps: competitorAnalysis.contentGaps.length,
      uniqueOpportunities: competitorAnalysis.uniqueOpportunities.length,
    });

    // Step 9: Generate article with keyword plan (uses external competitor analysis)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Generating article with keyword plan`);
    const { article: rawArticle, uniqueAngle } = await openaiService.generateArticleWithKeywordPlan(
      topic,
      keywordPlan,
      competitorAnalysis
    );
    log.info(`Raw article generated: ${rawArticle.wordCount} words`, {
      uniqueAngle: uniqueAngle.angle.substring(0, 80) + '...',
    });

    // Step 10: Check and improve originality
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Checking and improving originality`);
    const { content: originalContent, originalityCheck } = await humanizerService.enhanceOriginality(rawArticle.content);
    rawArticle.content = originalContent;
    log.info('Originality check complete', {
      score: originalityCheck.overallScore,
      genericPhrasesFound: originalityCheck.genericPhrases.length,
    });

    // Step 11: Humanize article
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Humanizing article content`);
    const humanizedArticle = await humanizerService.humanizeArticle(rawArticle);
    log.info(`Humanized article: ${humanizedArticle.wordCount} words`);

    // Step 12: Optimize readability
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Optimizing readability`);
    const { content: readableContent, initialScore, finalScore } = await readabilityService.enhanceReadability(humanizedArticle.content);
    humanizedArticle.content = readableContent;
    log.info('Readability optimization complete', {
      initialScore: initialScore.fleschReadingEase,
      finalScore: finalScore.fleschReadingEase,
      level: finalScore.readabilityLevel,
    });

    // Step 13: Generate FAQ
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Generating FAQ`);
    let faqData: Array<{ question: string; answer: string }> = [];
    try {
      faqData = await openaiService.generateFAQs(
        humanizedArticle.title,
        humanizedArticle.content,
        humanizedArticle.keywords
      );
      // Append FAQ HTML section to article content
      const faqHtml = renderFAQSection(faqData);
      if (faqHtml) {
        humanizedArticle.content += '\n\n' + faqHtml;
        log.info(`Added ${faqData.length} FAQ items to article`);
      }
    } catch (faqError) {
      log.warn('Failed to generate FAQ, continuing without', faqError);
    }

    // Step 14: Generate table of contents
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Generating table of contents`);
    try {
      const { tocHtml, contentWithIds } = generateTableOfContents(humanizedArticle.content);
      if (tocHtml) {
        humanizedArticle.content = contentWithIds;
        // Insert TOC after the first </p> (after introduction)
        const firstParagraphEnd = humanizedArticle.content.indexOf('</p>');
        if (firstParagraphEnd > 0) {
          const insertPos = firstParagraphEnd + 4;
          humanizedArticle.content =
            humanizedArticle.content.slice(0, insertPos) +
            '\n\n' + tocHtml + '\n\n' +
            humanizedArticle.content.slice(insertPos);
        }
        log.info('Table of contents generated and inserted');
      }
    } catch (tocError) {
      log.warn('Failed to generate table of contents, continuing without', tocError);
    }

    // Ensure unique slug
    humanizedArticle.slug = await wordpressService.ensureUniqueSlug(
      humanizedArticle.slug
    );

    // Step 15: Fetch featured image (if Unsplash is enabled)
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
          // Upload to WordPress with alt text and caption
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

          // Store attribution info in the article
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
        // Non-critical failure - continue with publishing
        log.warn('Failed to fetch featured image, continuing without', imageError);
      }
    }

    // Step 16: Add internal links (improved)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Adding internal links`);
    try {
      const linkKeywords = [
        humanizedArticle.keywords.primary,
        ...humanizedArticle.keywords.secondary,
        ...humanizedArticle.keywords.lsiKeywords.slice(0, 3),
      ];

      // Get cluster articles for priority linking
      const clusterArticles = clusterService.getClusterArticles(clusterResult.clusterId);
      const relatedPosts = await wordpressService.getRelatedPosts(linkKeywords, humanizedArticle.slug);

      // Add cluster articles as high-priority related posts (if not already found)
      const existingSlugs = new Set(relatedPosts.map(p => p.slug));
      for (const ca of clusterArticles) {
        if (!existingSlugs.has(ca.slug) && ca.slug !== humanizedArticle.slug) {
          relatedPosts.unshift({
            id: 0,
            title: ca.title,
            slug: ca.slug,
            link: ca.url,
            relevanceScore: 0.9, // High priority for same-cluster articles
          });
        }
      }

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

    // Step 17: Generate schema markup (Article + FAQ + Breadcrumb)
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Generating schema markup`);
    const postUrl = `${config.wordpress.url}/${humanizedArticle.slug}`;
    const articleSchema = schemaService.generateArticleSchema(humanizedArticle, {
      postUrl,
      publishDate: new Date(),
      categoryName: config.wordpress.category,
    });

    const schemas: object[] = [articleSchema];

    // Add FAQ schema if we have FAQ data
    if (faqData.length > 0) {
      const faqSchema = schemaService.generateFAQSchema(faqData);
      schemas.push(faqSchema);
      log.info('FAQ schema added');
    }

    // Add Breadcrumb schema
    const breadcrumbSchema = schemaService.generateBreadcrumbSchema([
      { name: 'Home', url: config.wordpress.url },
      { name: config.wordpress.category, url: `${config.wordpress.url}/category/${config.wordpress.category.toLowerCase().replace(/\s+/g, '-')}` },
      { name: humanizedArticle.title, url: postUrl },
    ]);
    schemas.push(breadcrumbSchema);
    log.info('Breadcrumb schema added');

    // Inject all schemas into content
    humanizedArticle.content = schemaService.injectMultipleSchemas(humanizedArticle.content, schemas);
    log.info('Schema markup generated and injected', {
      schemaCount: schemas.length,
    });

    // Step 18: Publish to WordPress
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Publishing to WordPress`);
    const post = await wordpressService.publishArticle(humanizedArticle, {
      featuredMediaId,
    });

    // Update schema with actual post URL (re-inject if URL differs)
    const schemaValidation = schemaService.validateSchema(articleSchema);
    if (!schemaValidation.valid) {
      log.warn('Schema validation issues', { errors: schemaValidation.errors });
    }

    // Step 19: Update topic cluster with published article
    currentStep++;
    log.info(`Step ${currentStep}/${totalSteps}: Updating topic cluster`);
    try {
      clusterService.addArticleToCluster(clusterResult.clusterId, {
        title: humanizedArticle.title,
        slug: humanizedArticle.slug,
        url: post.link,
        publishedAt: new Date().toISOString(),
        keywords: [
          humanizedArticle.keywords.primary,
          ...humanizedArticle.keywords.secondary,
        ],
        contentType: clusterResult.contentType,
      });
      log.info('Topic cluster updated with new article');
    } catch (clusterError) {
      log.warn('Failed to update topic cluster, continuing', clusterError);
    }

    const duration = Date.now() - startTime;
    const tokenUsage = openaiService.getTokenUsage();

    log.info('Enhanced pipeline completed successfully', {
      duration: `${(duration / 1000).toFixed(1)}s`,
      postId: post.id,
      postUrl: post.link,
      totalTokens: tokenUsage.totalTokens,
      hasFeaturedImage: !!humanizedArticle.featuredImage,
      hasFAQ: faqData.length > 0,
      readabilityScore: finalScore.fleschReadingEase,
      originalityScore: originalityCheck.overallScore,
      uniqueAngle: uniqueAngle.angle.substring(0, 50) + '...',
    });

    return {
      success: true,
      topic,
      article: humanizedArticle,
      postUrl: post.link,
      keywordPlan,
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
