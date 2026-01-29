import fs from 'fs';
import path from 'path';
import { TopicCluster, ClusterArticle } from '../types/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child('TopicCluster');

const DATA_DIR = path.join(process.cwd(), 'data');
const CLUSTERS_FILE = path.join(DATA_DIR, 'topic-clusters.json');

interface ClusterClassification {
  clusterId: string;
  contentType: 'pillar' | 'cluster';
  isNew: boolean;
}

export class TopicClusterService {
  private clusters: TopicCluster[] = [];

  constructor() {
    this.loadClusters();
  }

  /**
   * Load clusters from persistent storage
   */
  private loadClusters(): void {
    try {
      if (fs.existsSync(CLUSTERS_FILE)) {
        const data = fs.readFileSync(CLUSTERS_FILE, 'utf-8');
        this.clusters = JSON.parse(data);
        log.info(`Loaded ${this.clusters.length} topic clusters`);
      } else {
        this.clusters = [];
        log.info('No existing topic clusters found, starting fresh');
      }
    } catch (error) {
      log.warn('Failed to load topic clusters, starting fresh', error);
      this.clusters = [];
    }
  }

  /**
   * Save clusters to persistent storage
   */
  private saveClusters(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CLUSTERS_FILE, JSON.stringify(this.clusters, null, 2));
      log.info(`Saved ${this.clusters.length} topic clusters`);
    } catch (error) {
      log.error('Failed to save topic clusters', error);
    }
  }

  /**
   * Classify a topic: find matching cluster or create new one
   */
  classifyTopic(topic: string, relatedQueries: string[]): ClusterClassification {
    const topicWords = this.extractKeywords(topic);
    const allWords = [
      ...topicWords,
      ...relatedQueries.flatMap(q => this.extractKeywords(q)),
    ];

    // Try to find an existing cluster
    let bestMatch: { cluster: TopicCluster; score: number } | null = null;

    for (const cluster of this.clusters) {
      const score = this.calculateOverlap(allWords, cluster.keywords);
      if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { cluster, score };
      }
    }

    if (bestMatch) {
      // Determine content type: if cluster has no pillar, this could be one
      const hasPillar = bestMatch.cluster.articles.some(a => a.contentType === 'pillar');
      const contentType: 'pillar' | 'cluster' = hasPillar ? 'cluster' : 'pillar';

      log.info(`Topic matched to existing cluster: "${bestMatch.cluster.pillarTopic}" (score: ${bestMatch.score.toFixed(2)})`);

      // Update cluster keywords with new terms
      const newKeywords = allWords.filter(w => !bestMatch!.cluster.keywords.includes(w));
      if (newKeywords.length > 0) {
        bestMatch.cluster.keywords.push(...newKeywords.slice(0, 10));
        bestMatch.cluster.updatedAt = new Date().toISOString();
        this.saveClusters();
      }

      return {
        clusterId: bestMatch.cluster.id,
        contentType,
        isNew: false,
      };
    }

    // Create a new cluster
    const newCluster: TopicCluster = {
      id: this.generateId(),
      pillarTopic: topic,
      keywords: [...new Set(allWords)].slice(0, 30),
      articles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.clusters.push(newCluster);
    this.saveClusters();

    log.info(`Created new topic cluster: "${topic}" with ${newCluster.keywords.length} keywords`);

    return {
      clusterId: newCluster.id,
      contentType: 'pillar',
      isNew: true,
    };
  }

  /**
   * Add a published article to a cluster
   */
  addArticleToCluster(clusterId: string, article: ClusterArticle): void {
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) {
      log.warn(`Cluster ${clusterId} not found, cannot add article`);
      return;
    }

    // Avoid duplicates
    if (cluster.articles.some(a => a.slug === article.slug)) {
      log.info(`Article "${article.title}" already in cluster`);
      return;
    }

    cluster.articles.push(article);
    cluster.updatedAt = new Date().toISOString();

    // Add article keywords to cluster keywords
    const newKeywords = article.keywords.filter(k => !cluster.keywords.includes(k.toLowerCase()));
    cluster.keywords.push(...newKeywords.map(k => k.toLowerCase()));

    this.saveClusters();
    log.info(`Added article "${article.title}" to cluster "${cluster.pillarTopic}"`);
  }

  /**
   * Get articles in a cluster (for internal linking)
   */
  getClusterArticles(clusterId: string): ClusterArticle[] {
    const cluster = this.clusters.find(c => c.id === clusterId);
    return cluster?.articles || [];
  }

  /**
   * Get cluster info
   */
  getCluster(clusterId: string): TopicCluster | undefined {
    return this.clusters.find(c => c.id === clusterId);
  }

  /**
   * Extract meaningful keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'it', 'its', 'how', 'what', 'when', 'where', 'why', 'which', 'who',
      'not', 'no', 'nor', 'from', 'up', 'about', 'into', 'over', 'after',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Calculate keyword overlap score between two sets
   */
  private calculateOverlap(words1: string[], words2: string[]): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = [...set1].filter(w => set2.has(w));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.length / union.size : 0;
  }

  /**
   * Generate a unique cluster ID
   */
  private generateId(): string {
    return `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
