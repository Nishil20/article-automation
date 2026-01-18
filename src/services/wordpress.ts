import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Config,
  GeneratedArticle,
  WordPressPostData,
  WordPressPostResponse,
  RelatedPost,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child('WordPress');

interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
}

export class WordPressService {
  private client: AxiosInstance;
  private config: Config['wordpress'];
  private categoryCache: Map<string, number> = new Map();

  constructor(config: Config) {
    this.config = config.wordpress;

    // Create axios instance with Basic Auth
    const auth = Buffer.from(
      `${this.config.username}:${this.config.appPassword}`
    ).toString('base64');

    this.client = axios.create({
      baseURL: `${this.config.url}/wp-json/wp/v2`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          log.error('WordPress API error', {
            status: error.response.status,
            data: error.response.data,
          });
        }
        throw error;
      }
    );
  }

  /**
   * Test the WordPress connection
   */
  async testConnection(): Promise<boolean> {
    try {
      log.info('Testing WordPress connection');
      // Use posts endpoint instead of users/me (more compatible with various hosts)
      const response = await this.client.get('/posts', {
        params: { per_page: 1 },
      });
      log.info(`Connected successfully. Found ${response.headers['x-wp-total'] || 'some'} posts.`);
      return true;
    } catch (error) {
      log.error('WordPress connection failed', error);
      return false;
    }
  }

  /**
   * Get all categories and cache them
   */
  async getCategories(): Promise<WordPressCategory[]> {
    try {
      log.info('Fetching WordPress categories');
      const response = await this.client.get<WordPressCategory[]>('/categories', {
        params: { per_page: 100 },
      });

      // Cache categories by name (lowercase for matching)
      for (const cat of response.data) {
        this.categoryCache.set(cat.name.toLowerCase(), cat.id);
        this.categoryCache.set(cat.slug.toLowerCase(), cat.id);
      }

      log.info(`Fetched ${response.data.length} categories`);
      return response.data;
    } catch (error) {
      log.error('Failed to fetch categories', error);
      throw error;
    }
  }

  /**
   * Get category ID by name or slug
   */
  async getCategoryId(nameOrSlug: string): Promise<number> {
    // Check cache first
    const cached = this.categoryCache.get(nameOrSlug.toLowerCase());
    if (cached) {
      return cached;
    }

    // Fetch categories if cache is empty
    if (this.categoryCache.size === 0) {
      await this.getCategories();
      const cached = this.categoryCache.get(nameOrSlug.toLowerCase());
      if (cached) {
        return cached;
      }
    }

    // Try to find by ID if numeric
    if (!isNaN(Number(nameOrSlug))) {
      return Number(nameOrSlug);
    }

    // Default to "Uncategorized" (usually ID 1)
    log.warn(`Category "${nameOrSlug}" not found, using default`);
    return 1;
  }

  /**
   * Create a new category if it doesn't exist
   */
  async createCategory(name: string): Promise<number> {
    try {
      // Check if exists
      const existingId = this.categoryCache.get(name.toLowerCase());
      if (existingId) {
        return existingId;
      }

      log.info(`Creating category: ${name}`);
      const response = await this.client.post<WordPressCategory>('/categories', {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
      });

      // Add to cache
      this.categoryCache.set(response.data.name.toLowerCase(), response.data.id);
      this.categoryCache.set(response.data.slug.toLowerCase(), response.data.id);

      return response.data.id;
    } catch (error) {
      // Category might already exist (race condition)
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        await this.getCategories();
        const existingId = this.categoryCache.get(name.toLowerCase());
        if (existingId) {
          return existingId;
        }
      }
      throw error;
    }
  }

  /**
   * Publish an article to WordPress
   */
  async publishArticle(
    article: GeneratedArticle,
    options: {
      status?: 'publish' | 'draft' | 'future';
      scheduledDate?: Date;
      categoryOverride?: string;
      featuredMediaId?: number;
    } = {}
  ): Promise<WordPressPostResponse> {
    const { status = 'publish', scheduledDate, categoryOverride, featuredMediaId } = options;

    log.info(`Publishing article: ${article.title}`);

    // Get category ID
    const categoryName = categoryOverride || this.config.category;
    const categoryId = await this.getCategoryId(categoryName);

    // Build post data
    const postData: WordPressPostData = {
      title: article.title,
      content: article.content,
      slug: article.slug,
      excerpt: article.excerpt,
      status: scheduledDate ? 'future' : status,
      categories: [categoryId],
    };

    // Add scheduled date if provided
    if (scheduledDate) {
      postData.date = scheduledDate.toISOString();
    }

    // Add featured image if provided
    if (featuredMediaId) {
      postData.featured_media = featuredMediaId;
    }

    // Add SEO meta fields for both Yoast and RankMath
    postData.meta = {
      // Yoast SEO
      _yoast_wpseo_title: article.metaTitle,
      _yoast_wpseo_metadesc: article.metaDescription,
      // RankMath SEO
      rank_math_focus_keyword: article.keywords.primary,
      rank_math_description: article.metaDescription,
      rank_math_title: article.metaTitle,
    };

    log.info('SEO meta fields to be set', {
      primaryKeyword: article.keywords.primary,
      metaTitle: article.metaTitle,
      metaDescLength: article.metaDescription?.length,
    });

    try {
      const response = await this.client.post<WordPressPostResponse>(
        '/posts',
        postData
      );

      log.info('Article published successfully', {
        id: response.data.id,
        link: response.data.link,
        status: response.data.status,
      });

      // Try to update RankMath meta separately if initial post didn't set them
      // This handles cases where RankMath requires a separate update
      try {
        await this.updateRankMathMeta(response.data.id, {
          focusKeyword: article.keywords.primary,
          description: article.metaDescription,
          title: article.metaTitle,
        });
      } catch (metaError) {
        log.warn('Could not update RankMath meta (may require manual setup)', metaError);
      }

      return response.data;
    } catch (error) {
      log.error('Failed to publish article', error);
      throw error;
    }
  }

  /**
   * Update RankMath SEO meta fields for a post
   * Uses direct post meta update which some setups require
   */
  private async updateRankMathMeta(
    postId: number,
    meta: {
      focusKeyword: string;
      description: string;
      title: string;
    }
  ): Promise<void> {
    try {
      await this.client.post(`/posts/${postId}`, {
        meta: {
          rank_math_focus_keyword: meta.focusKeyword,
          rank_math_description: meta.description,
          rank_math_title: meta.title,
          // Alternative meta key format some versions use
          _rank_math_focus_keyword: meta.focusKeyword,
        },
      });
      log.info(`RankMath meta updated for post ${postId}`, {
        focusKeyword: meta.focusKeyword,
      });
    } catch (error) {
      // If this fails, it's likely a permissions issue with meta fields
      throw error;
    }
  }

  /**
   * Update an existing post
   */
  async updatePost(
    postId: number,
    data: Partial<WordPressPostData>
  ): Promise<WordPressPostResponse> {
    try {
      log.info(`Updating post ${postId}`);
      const response = await this.client.put<WordPressPostResponse>(
        `/posts/${postId}`,
        data
      );
      log.info(`Post ${postId} updated`);
      return response.data;
    } catch (error) {
      log.error(`Failed to update post ${postId}`, error);
      throw error;
    }
  }

  /**
   * Check if a slug already exists
   */
  async slugExists(slug: string): Promise<boolean> {
    try {
      const response = await this.client.get('/posts', {
        params: { slug, status: 'any' },
      });
      return response.data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique slug
   */
  async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    if (slug !== baseSlug) {
      log.info(`Slug "${baseSlug}" exists, using "${slug}"`);
    }

    return slug;
  }

  /**
   * Upload media (for featured images)
   */
  async uploadMedia(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ id: number; url: string }> {
    try {
      log.info(`Uploading media: ${filename}`);

      const response = await this.client.post('/media', buffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });

      return {
        id: response.data.id,
        url: response.data.source_url,
      };
    } catch (error) {
      log.error('Failed to upload media', error);
      throw error;
    }
  }

  /**
   * Set featured image for a post
   */
  async setFeaturedImage(postId: number, mediaId: number): Promise<void> {
    try {
      await this.client.put(`/posts/${postId}`, {
        featured_media: mediaId,
      });
      log.info(`Set featured image for post ${postId}`);
    } catch (error) {
      log.error('Failed to set featured image', error);
      throw error;
    }
  }

  /**
   * Search for related posts based on keywords
   */
  async getRelatedPosts(
    keywords: string[],
    excludeSlug?: string,
    limit: number = 5
  ): Promise<RelatedPost[]> {
    try {
      log.info('Searching for related posts', { keywords, limit });

      const relatedPosts: RelatedPost[] = [];
      const seenIds = new Set<number>();

      // Search for posts matching each keyword
      for (const keyword of keywords.slice(0, 3)) {
        try {
          const response = await this.client.get('/posts', {
            params: {
              search: keyword,
              per_page: limit,
              status: 'publish',
              _fields: 'id,title,slug,link',
            },
          });

          for (const post of response.data) {
            // Skip if already seen or if it's the current article
            if (seenIds.has(post.id)) continue;
            if (excludeSlug && post.slug === excludeSlug) continue;

            seenIds.add(post.id);

            // Calculate a simple relevance score based on keyword match
            const title = post.title.rendered.toLowerCase();
            const keywordLower = keyword.toLowerCase();
            const relevanceScore = title.includes(keywordLower) ? 1.0 : 0.5;

            relatedPosts.push({
              id: post.id,
              title: post.title.rendered,
              slug: post.slug,
              link: post.link,
              relevanceScore,
            });
          }
        } catch (searchError) {
          log.warn(`Failed to search for keyword: ${keyword}`, searchError);
        }
      }

      // Sort by relevance and limit results
      const sortedPosts = relatedPosts
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      log.info(`Found ${sortedPosts.length} related posts`);
      return sortedPosts;
    } catch (error) {
      log.error('Failed to get related posts', error);
      return [];
    }
  }

  /**
   * Inject internal links into content
   * Adds 2-3 relevant internal links to the article body
   */
  injectInternalLinks(
    content: string,
    relatedPosts: RelatedPost[],
    maxLinks: number = 3
  ): string {
    if (relatedPosts.length === 0) {
      log.info('No related posts to link to');
      return content;
    }

    log.info(`Injecting up to ${maxLinks} internal links`);

    let updatedContent = content;
    let linksAdded = 0;

    // Get the top related posts
    const postsToLink = relatedPosts.slice(0, maxLinks);

    for (const post of postsToLink) {
      // Extract key terms from the post title to find matching text
      const titleWords = post.title
        .replace(/<[^>]+>/g, '') // Remove HTML entities
        .replace(/&[^;]+;/g, '') // Remove HTML entities
        .split(/\s+/)
        .filter(word => word.length > 4) // Only words > 4 chars
        .slice(0, 3); // Take first 3 significant words

      // Try to find a matching phrase in the content to link
      for (const word of titleWords) {
        // Create a regex to find the word (not already in a link)
        const wordRegex = new RegExp(
          `(?<!<a[^>]*>)\\b(${this.escapeRegex(word)})\\b(?![^<]*<\\/a>)`,
          'i'
        );

        if (wordRegex.test(updatedContent)) {
          // Replace first occurrence with a link
          updatedContent = updatedContent.replace(
            wordRegex,
            `<a href="${post.link}" title="${this.escapeHtml(post.title)}">$1</a>`
          );
          linksAdded++;
          log.info(`Added internal link to: ${post.title}`);
          break; // Only add one link per related post
        }
      }

      if (linksAdded >= maxLinks) break;
    }

    // If we couldn't add links naturally, add a "Related Articles" section
    if (linksAdded === 0 && postsToLink.length > 0) {
      const relatedSection = this.createRelatedSection(postsToLink);
      
      // Insert before the closing paragraph or at the end
      const lastParagraphIndex = updatedContent.lastIndexOf('</p>');
      if (lastParagraphIndex > 0) {
        updatedContent =
          updatedContent.slice(0, lastParagraphIndex + 4) +
          relatedSection +
          updatedContent.slice(lastParagraphIndex + 4);
      } else {
        updatedContent += relatedSection;
      }
      
      log.info('Added related articles section');
    }

    log.info(`Internal linking complete, ${linksAdded} inline links added`);
    return updatedContent;
  }

  /**
   * Create a "Related Articles" HTML section
   */
  private createRelatedSection(posts: RelatedPost[]): string {
    const links = posts
      .slice(0, 3)
      .map(post => `<li><a href="${post.link}">${this.escapeHtml(post.title)}</a></li>`)
      .join('\n');

    return `
<h3>Related Articles</h3>
<ul>
${links}
</ul>`;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
