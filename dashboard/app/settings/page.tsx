'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowLeft, Save, Loader2, Check, Image, AlertCircle } from 'lucide-react';

interface Settings {
  openaiModel: string;
  wpCategory: string;
  trendsGeo: string;
  voiceTone: string;
  voicePerspective: string;
  voicePersonality: string;
  unsplashEnabled: boolean;
}

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Faster, cheaper)' },
];

const TONES = [
  { value: 'conversational', label: 'Conversational' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'authoritative', label: 'Authoritative' },
];

const PERSPECTIVES = [
  { value: 'first_person', label: 'First Person (I, we)' },
  { value: 'second_person', label: 'Second Person (you)' },
  { value: 'third_person', label: 'Third Person (they, users)' },
];

const GEO_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    openaiModel: 'gpt-4o',
    wpCategory: 'Uncategorized',
    trendsGeo: 'US',
    voiceTone: 'conversational',
    voicePerspective: 'second_person',
    voicePersonality: 'friendly expert who uses analogies',
    unsplashEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof Settings, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure article generation
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2',
              'bg-primary text-primary-foreground font-medium rounded-lg',
              'hover:bg-primary/90 disabled:opacity-50',
              'transition-colors'
            )}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* AI Settings */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">AI Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                OpenAI Model
              </label>
              <select
                value={settings.openaiModel}
                onChange={(e) => handleChange('openaiModel', e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 bg-secondary border border-border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              >
                {MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Voice Settings */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Voice Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Writing Tone
              </label>
              <select
                value={settings.voiceTone}
                onChange={(e) => handleChange('voiceTone', e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 bg-secondary border border-border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              >
                {TONES.map((tone) => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Perspective
              </label>
              <select
                value={settings.voicePerspective}
                onChange={(e) => handleChange('voicePerspective', e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 bg-secondary border border-border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              >
                {PERSPECTIVES.map((perspective) => (
                  <option key={perspective.value} value={perspective.value}>
                    {perspective.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Personality
              </label>
              <input
                type="text"
                value={settings.voicePersonality}
                onChange={(e) => handleChange('voicePersonality', e.target.value)}
                placeholder="e.g., friendly expert who uses analogies"
                className={cn(
                  'w-full px-4 py-2.5 bg-secondary border border-border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Describe the writing personality for the AI
              </p>
            </div>
          </div>
        </section>

        {/* Content Settings */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Content Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                WordPress Category
              </label>
              <input
                type="text"
                value={settings.wpCategory}
                onChange={(e) => handleChange('wpCategory', e.target.value)}
                placeholder="e.g., Blog, News, Tech"
                className={cn(
                  'w-full px-4 py-2.5 bg-secondary border border-border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Trends Region
              </label>
              <select
                value={settings.trendsGeo}
                onChange={(e) => handleChange('trendsGeo', e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 bg-secondary border border-border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              >
                {GEO_OPTIONS.map((geo) => (
                  <option key={geo.value} value={geo.value}>
                    {geo.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Region for Google Trends topic discovery
              </p>
            </div>
          </div>
        </section>

        {/* Featured Image Settings */}
        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Image className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Featured Images</h2>
              <p className="text-sm text-muted-foreground">
                Automatically add images from Unsplash
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
              <div className="flex-1">
                <label className="block text-sm font-medium">
                  Enable Featured Images
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fetch relevant stock photos from Unsplash for each article
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.unsplashEnabled}
                onClick={() => handleChange('unsplashEnabled', !settings.unsplashEnabled)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  settings.unsplashEnabled ? 'bg-primary' : 'bg-secondary'
                )}
              >
                <span
                  className={cn(
                    'block w-5 h-5 bg-white rounded-full shadow transition-transform',
                    settings.unsplashEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {!settings.unsplashEnabled && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-500">
                    Unsplash API Key Required
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    To enable featured images, add <code className="px-1 py-0.5 bg-secondary rounded">UNSPLASH_ACCESS_KEY</code> to your environment variables.
                    Get a free API key from{' '}
                    <a 
                      href="https://unsplash.com/developers" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      unsplash.com/developers
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
