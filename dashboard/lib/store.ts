import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export interface ArticleRecord {
  id: string;
  topic: string;
  title: string;
  slug: string;
  wordCount: number;
  status: 'published' | 'failed' | 'pending';
  postUrl?: string;
  postId?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Settings {
  openaiModel: string;
  wpCategory: string;
  trendsGeo: string;
  voiceTone: string;
  voicePerspective: string;
  voicePersonality: string;
  unsplashEnabled: boolean;
}

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

async function readJSON<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// History operations
export async function getHistory(): Promise<ArticleRecord[]> {
  return readJSON<ArticleRecord[]>(HISTORY_FILE, []);
}

export async function addToHistory(record: ArticleRecord): Promise<void> {
  const history = await getHistory();
  history.unshift(record);
  // Keep only last 100 records
  if (history.length > 100) {
    history.splice(100);
  }
  await writeJSON(HISTORY_FILE, history);
}

export async function updateHistoryRecord(
  id: string,
  updates: Partial<ArticleRecord>
): Promise<void> {
  const history = await getHistory();
  const index = history.findIndex((r) => r.id === id);
  if (index !== -1) {
    history[index] = { ...history[index], ...updates };
    await writeJSON(HISTORY_FILE, history);
  }
}

export async function getHistoryRecord(id: string): Promise<ArticleRecord | null> {
  const history = await getHistory();
  return history.find((r) => r.id === id) || null;
}

// Settings operations
export async function getSettings(): Promise<Settings> {
  const defaults: Settings = {
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
    wpCategory: process.env.WP_CATEGORY || 'Uncategorized',
    trendsGeo: process.env.TRENDS_GEO || 'US',
    voiceTone: process.env.VOICE_TONE || 'conversational',
    voicePerspective: process.env.VOICE_PERSPECTIVE || 'second_person',
    voicePersonality: process.env.VOICE_PERSONALITY || 'friendly expert who uses analogies',
    unsplashEnabled: process.env.UNSPLASH_ENABLED !== 'false' && !!process.env.UNSPLASH_ACCESS_KEY,
  };
  return readJSON<Settings>(SETTINGS_FILE, defaults);
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await writeJSON(SETTINGS_FILE, updated);
  return updated;
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
