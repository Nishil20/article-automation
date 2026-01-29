import { GeneratedArticle, ArticleSchemaMarkup, Config } from '../types/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child('Schema');

export interface SchemaConfig {
  siteName: string;
  siteUrl: string;
  authorName: string;
  authorUrl?: string;
  logoUrl?: string;
  publisherType?: 'Person' | 'Organization';
}

export class SchemaService {
  private config: SchemaConfig;

  constructor(wordpressConfig: Config['wordpress'], customConfig?: Partial<SchemaConfig>) {
    // Extract site info from WordPress URL
    const siteUrl = wordpressConfig.url.replace(/\/+$/, '');
    const siteName = this.extractSiteName(siteUrl);

    this.config = {
      siteName: customConfig?.siteName || siteName,
      siteUrl: customConfig?.siteUrl || siteUrl,
      authorName: customConfig?.authorName || 'Editorial Team',
      authorUrl: customConfig?.authorUrl,
      logoUrl: customConfig?.logoUrl,
      publisherType: customConfig?.publisherType || 'Organization',
    };

    log.info('Schema service initialized', {
      siteName: this.config.siteName,
      siteUrl: this.config.siteUrl,
    });
  }

  /**
   * Extract a readable site name from URL
   */
  private extractSiteName(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      // Remove www. and common TLDs, capitalize
      const name = hostname
        .replace(/^www\./, '')
        .replace(/\.(com|org|net|io|co|blog)$/, '')
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      return name;
    } catch {
      return 'Website';
    }
  }

  /**
   * Generate Article schema markup (JSON-LD)
   */
  generateArticleSchema(
    article: GeneratedArticle,
    options: {
      postUrl: string;
      publishDate?: Date;
      modifiedDate?: Date;
      categoryName?: string;
    }
  ): ArticleSchemaMarkup {
    log.info('Generating Article schema markup', {
      title: article.title,
      postUrl: options.postUrl,
    });

    const publishDate = options.publishDate || new Date();
    const modifiedDate = options.modifiedDate || publishDate;

    const schema: ArticleSchemaMarkup = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.metaTitle || article.title,
      description: article.metaDescription || article.excerpt,
      author: {
        '@type': this.config.publisherType === 'Person' ? 'Person' : 'Person',
        name: this.config.authorName,
        ...(this.config.authorUrl && { url: this.config.authorUrl }),
      },
      publisher: {
        '@type': 'Organization',
        name: this.config.siteName,
        ...(this.config.logoUrl && {
          logo: {
            '@type': 'ImageObject',
            url: this.config.logoUrl,
          },
        }),
      },
      datePublished: publishDate.toISOString(),
      dateModified: modifiedDate.toISOString(),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': options.postUrl,
      },
      wordCount: article.wordCount,
      keywords: [
        article.keywords.primary,
        ...article.keywords.secondary,
      ].join(', '),
    };

    // Add featured image if available
    if (article.featuredImage?.url) {
      schema.image = article.featuredImage.url;
    }

    // Add article section (category) if available
    if (options.categoryName) {
      schema.articleSection = options.categoryName;
    }

    log.info('Article schema generated successfully');
    return schema;
  }

  /**
   * Convert schema to JSON-LD script tag for embedding in HTML
   */
  toScriptTag(schema: ArticleSchemaMarkup): string {
    return `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`;
  }

  /**
   * Inject schema markup into HTML content
   * Adds JSON-LD at the end of the content
   */
  injectSchema(content: string, schema: ArticleSchemaMarkup): string {
    const scriptTag = this.toScriptTag(schema);
    
    // Add schema at the end of the content
    return `${content}\n\n${scriptTag}`;
  }

  /**
   * Generate and inject schema in one step
   */
  generateAndInject(
    article: GeneratedArticle,
    content: string,
    options: {
      postUrl: string;
      publishDate?: Date;
      modifiedDate?: Date;
      categoryName?: string;
    }
  ): {
    content: string;
    schema: ArticleSchemaMarkup;
  } {
    const schema = this.generateArticleSchema(article, options);
    const contentWithSchema = this.injectSchema(content, schema);

    return {
      content: contentWithSchema,
      schema,
    };
  }

  /**
   * Validate schema structure
   */
  validateSchema(schema: ArticleSchemaMarkup): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!schema['@context'] || schema['@context'] !== 'https://schema.org') {
      errors.push('Missing or invalid @context');
    }

    if (!schema['@type'] || schema['@type'] !== 'Article') {
      errors.push('Missing or invalid @type');
    }

    if (!schema.headline || schema.headline.length === 0) {
      errors.push('Missing headline');
    }

    if (schema.headline && schema.headline.length > 110) {
      errors.push('Headline exceeds recommended 110 character limit');
    }

    if (!schema.author?.name) {
      errors.push('Missing author name');
    }

    if (!schema.publisher?.name) {
      errors.push('Missing publisher name');
    }

    if (!schema.datePublished) {
      errors.push('Missing datePublished');
    }

    if (!schema.mainEntityOfPage?.['@id']) {
      errors.push('Missing mainEntityOfPage URL');
    }

    const valid = errors.length === 0;

    if (!valid) {
      log.warn('Schema validation issues found', { errors });
    } else {
      log.info('Schema validation passed');
    }

    return { valid, errors };
  }

  /**
   * Generate FAQ schema if the content contains Q&A sections
   */
  generateFAQSchema(
    questions: Array<{ question: string; answer: string }>
  ): object {
    if (questions.length === 0) return {};

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions.map(qa => ({
        '@type': 'Question',
        name: qa.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: qa.answer,
        },
      })),
    };
  }

  /**
   * Generate BreadcrumbList schema
   */
  generateBreadcrumbSchema(
    items: Array<{ name: string; url: string }>
  ): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    };
  }

  /**
   * Inject multiple JSON-LD schemas into HTML content
   */
  injectMultipleSchemas(content: string, schemas: object[]): string {
    const scriptTags = schemas
      .filter(schema => Object.keys(schema).length > 0)
      .map(
        (schema) =>
          `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
      )
      .join('\n');

    return `${content}\n\n${scriptTags}`;
  }
}
