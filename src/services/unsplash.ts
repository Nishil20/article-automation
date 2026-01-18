import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

const log = logger.child('Unsplash');

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    links: {
      html: string;
    };
  };
  alt_description: string | null;
  description: string | null;
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

export interface FeaturedImageData {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
}

export interface UnsplashConfig {
  accessKey: string;
  enabled: boolean;
}

export class UnsplashService {
  private client: AxiosInstance;
  private enabled: boolean;

  constructor(config: UnsplashConfig) {
    this.enabled = config.enabled && !!config.accessKey;

    this.client = axios.create({
      baseURL: 'https://api.unsplash.com',
      headers: {
        Authorization: `Client-ID ${config.accessKey}`,
      },
      timeout: 30000,
    });

    if (this.enabled) {
      log.info('Unsplash service initialized');
    } else {
      log.info('Unsplash service disabled (no API key or disabled in config)');
    }
  }

  /**
   * Check if the service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Search for a relevant image based on keywords
   */
  async searchImage(query: string): Promise<UnsplashPhoto | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      log.info(`Searching Unsplash for: ${query}`);

      const response = await this.client.get<UnsplashSearchResponse>('/search/photos', {
        params: {
          query,
          per_page: 5,
          orientation: 'landscape', // Better for featured images
          content_filter: 'high', // Safe content only
        },
      });

      if (response.data.results.length === 0) {
        log.warn(`No images found for query: ${query}`);
        return null;
      }

      // Return the first (most relevant) result
      const photo = response.data.results[0];
      log.info(`Found image by ${photo.user.name}`);

      return photo;
    } catch (error) {
      log.error('Failed to search Unsplash', error);
      return null;
    }
  }

  /**
   * Download an image and return as buffer
   */
  async downloadImage(photo: UnsplashPhoto): Promise<Buffer | null> {
    try {
      log.info(`Downloading image: ${photo.id}`);

      // Use 'regular' size for good quality without being too large
      // Regular is typically 1080px wide
      const response = await axios.get(photo.urls.regular, {
        responseType: 'arraybuffer',
        timeout: 60000, // Images can be large
      });

      // Trigger download endpoint to follow Unsplash API guidelines
      await this.triggerDownload(photo.id);

      return Buffer.from(response.data);
    } catch (error) {
      log.error('Failed to download image', error);
      return null;
    }
  }

  /**
   * Trigger the download endpoint (required by Unsplash API guidelines)
   */
  private async triggerDownload(photoId: string): Promise<void> {
    try {
      await this.client.get(`/photos/${photoId}/download`);
    } catch {
      // Non-critical, just for tracking
      log.warn('Could not trigger download tracking');
    }
  }

  /**
   * Get a featured image for an article topic
   */
  async getFeaturedImage(primaryKeyword: string, fallbackQuery?: string): Promise<FeaturedImageData | null> {
    if (!this.enabled) {
      log.info('Unsplash disabled, skipping featured image');
      return null;
    }

    // Try primary keyword first
    let photo = await this.searchImage(primaryKeyword);

    // If no results, try fallback query (e.g., topic title)
    if (!photo && fallbackQuery && fallbackQuery !== primaryKeyword) {
      log.info(`Trying fallback query: ${fallbackQuery}`);
      photo = await this.searchImage(fallbackQuery);
    }

    // If still no results, try a more generic search
    if (!photo) {
      const genericQuery = primaryKeyword.split(' ')[0]; // First word only
      if (genericQuery.length > 3) {
        log.info(`Trying generic query: ${genericQuery}`);
        photo = await this.searchImage(genericQuery);
      }
    }

    if (!photo) {
      log.warn('Could not find any suitable image');
      return null;
    }

    // Download the image
    const buffer = await this.downloadImage(photo);
    if (!buffer) {
      return null;
    }

    // Generate filename from photo ID
    const filename = `unsplash-${photo.id}.jpg`;

    return {
      buffer,
      filename,
      mimeType: 'image/jpeg',
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      unsplashUrl: `https://unsplash.com/photos/${photo.id}`,
    };
  }
}
