# Article Automation System

Automated SEO article generation and WordPress publishing system. This pipeline discovers trending topics, generates humanized SEO-optimized articles using OpenAI GPT-4, and publishes them to WordPress with featured images, internal links, and schema markup.

## Features

- **Multi-Source Topic Discovery**: Fetches trending topics from RSS feeds, Google Trends, or AI-generated suggestions
- **Competitor Analysis**: Analyzes existing content to find unique angles and content gaps
- **SEO-Optimized Content**: Generates articles with proper keyword targeting, structure, and meta tags
- **Human-Like Writing**: Multi-pass humanization and originality enhancement pipeline
- **Readability Optimization**: Flesch-Kincaid scoring with automatic improvements
- **Featured Images**: Automatically adds relevant stock photos from Unsplash
- **Internal Linking**: Finds and links to related posts on your site
- **Schema Markup**: Adds Article JSON-LD for rich search results
- **WordPress Integration**: Publishes via REST API with Yoast/RankMath SEO support
- **Web Dashboard**: Next.js dashboard for monitoring and manual triggers
- **Scheduled Automation**: Runs on GitHub Actions cron for hands-free operation

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Topic Sources  │────▶│   Competitor    │────▶│  OpenAI GPT-4   │
│ RSS/Google/AI   │     │    Analysis     │     │ (Generation)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│   WordPress     │◀────│  SEO & Schema   │◀────│   Humanizer     │
│  (Publishing)   │     │   Enhancement   │     │ + Readability   │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         │              ┌─────────────────┐
         └──────────────│    Unsplash     │
                        │ (Featured Image)│
                        └─────────────────┘
```

## Pipeline Steps

1. **WordPress Connection Test** - Verify credentials
2. **Topic Discovery** - Fetch trending topic from configured sources
3. **Competitor Analysis** - Identify content gaps and unique opportunities
4. **Article Generation** - Create SEO-optimized content with unique angle
5. **Originality Enhancement** - Replace generic phrases, improve uniqueness
6. **Humanization** - Multi-pass rewriting for natural tone
7. **Readability Optimization** - Adjust sentence structure for target reading level
8. **Featured Image** - Fetch and upload from Unsplash (optional)
9. **Internal Linking** - Add links to related posts
10. **Schema Markup** - Generate Article JSON-LD
11. **Publish** - Post to WordPress with SEO meta fields

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd article-automation
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your API keys and WordPress credentials.

### 3. Run Locally

```bash
# Build TypeScript
npm run build

# Run the pipeline
npm start

# Or use dev mode (no build required)
npm run dev
```

### 4. Run Dashboard (Optional)

```bash
# Start the web dashboard
npm run dashboard
```

Open http://localhost:3000 to access the dashboard.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `WP_URL` | WordPress site URL (no trailing slash) |
| `WP_USERNAME` | WordPress username |
| `WP_APP_PASSWORD` | WordPress application password |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use |
| `WP_CATEGORY` | `Uncategorized` | Default post category |
| `TRENDS_GEO` | `US` | Google Trends geography |
| `TRENDS_CATEGORY` | `all` | Topic category filter |
| `TOPIC_SOURCES` | `rss,google,openai,fallback` | Topic sources in priority order |
| `UNSPLASH_ACCESS_KEY` | - | Unsplash API key for featured images |
| `UNSPLASH_ENABLED` | `true` | Enable/disable featured images |
| `VOICE_TONE` | `conversational` | Writing tone |
| `VOICE_PERSPECTIVE` | `second_person` | POV (first/second/third) |
| `VOICE_PERSONALITY` | `friendly expert...` | Custom persona description |
| `LOG_LEVEL` | `info` | Logging verbosity |

## WordPress Setup

### Generate Application Password

1. Log in to WordPress admin
2. Go to **Users > Profile**
3. Scroll to **Application Passwords**
4. Enter a name (e.g., "Article Automation")
5. Click **Add New Application Password**
6. Copy the generated password (shown only once)

### Enable REST API

The WordPress REST API is enabled by default. If you're using security plugins, ensure these endpoints are accessible:

- `POST /wp-json/wp/v2/posts`
- `POST /wp-json/wp/v2/media`
- `GET /wp-json/wp/v2/posts`
- `GET /wp-json/wp/v2/categories`

### SEO Plugin Integration

The system automatically sets meta fields for both **Yoast SEO** and **RankMath**:

| Plugin | Fields Set |
|--------|------------|
| Yoast SEO | `_yoast_wpseo_title`, `_yoast_wpseo_metadesc` |
| RankMath | `rank_math_focus_keyword`, `rank_math_title`, `rank_math_description` |

Note: RankMath's focus keyword field may not populate via REST API by default (it's a dashboard-only feature that doesn't affect actual SEO rankings).

## Topic Sources

The system supports multiple topic sources, tried in order until one succeeds:

| Source | Description |
|--------|-------------|
| `rss` | Fetches from configured RSS feeds (news sites) |
| `google` | Google Trends daily trends |
| `openai` | AI-generated trending topic suggestions |
| `fallback` | Evergreen topics when others fail |

Configure priority with:

```env
TOPIC_SOURCES=rss,google,openai,fallback
```

## Unsplash Setup

### 1. Create Developer Account

1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Click "Register as a developer"
3. Create a new application
4. Copy your **Access Key** (not the Secret Key)

### 2. Configure

```env
UNSPLASH_ACCESS_KEY=your-access-key-here
UNSPLASH_ENABLED=true
```

### Rate Limits

Free tier allows 50 requests/hour. The system searches using the article's primary keyword and falls back to the topic title if no results are found.

## GitHub Actions Setup

### 1. Add Repository Secrets

Go to **Settings > Secrets and variables > Actions** and add:

| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `WP_URL` | WordPress site URL |
| `WP_USERNAME` | WordPress username |
| `WP_APP_PASSWORD` | WordPress application password |
| `UNSPLASH_ACCESS_KEY` | (Optional) Unsplash API access key |

### 2. Add Repository Variables (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model |
| `WP_CATEGORY` | `Uncategorized` | Default category |
| `TRENDS_GEO` | `US` | Trends geography |
| `VOICE_TONE` | `conversational` | Writing tone |
| `VOICE_PERSPECTIVE` | `second_person` | POV |

### 3. Schedule

The workflow runs daily at 9 AM UTC. Modify the cron in `.github/workflows/publish-article.yml`:

```yaml
schedule:
  - cron: '0 9 * * *'      # Daily at 9 AM UTC
  - cron: '0 9,21 * * *'   # Twice daily
  - cron: '0 9 * * 1-5'    # Weekdays only
```

### 4. Manual Trigger

Trigger manually from the Actions tab with custom options (voice tone, dry run mode).

## Dashboard

The web dashboard provides:

- **Status Overview** - Current pipeline state and recent activity
- **Manual Generation** - Trigger article generation with custom settings
- **History** - View all generated articles with links
- **Settings** - Test WordPress connection and view configuration

### Running the Dashboard

```bash
# Development mode
npm run dashboard

# Production build
npm run dashboard:build
```

## Voice Configuration

### Tone Options

| Tone | Description |
|------|-------------|
| `conversational` | Friendly, like talking to a colleague |
| `professional` | Authoritative but accessible |
| `casual` | Light and blog-like |
| `authoritative` | Definitive expert resource |

### Perspective Options

| Perspective | Example |
|-------------|---------|
| `first_person` | "I recommend...", "We found..." |
| `second_person` | "You'll discover...", "Your best option..." |
| `third_person` | "Users should...", "The data shows..." |

### Custom Personality

```env
VOICE_PERSONALITY=witty tech journalist who explains complex topics with pop culture references
```

## Humanization Pipeline

The system uses a multi-pass approach:

1. **Originality Check** - Identify and replace generic AI phrases
2. **Quick Word Replacement** - Replace robotic words (utilize > use, leverage > take advantage of)
3. **Burstiness Analysis** - Ensure varied sentence lengths
4. **AI Humanization Pass** - Rewrite for natural flow, contractions, rhetorical questions
5. **Readability Optimization** - Target Flesch-Kincaid grade level 8-10
6. **Final Polish** - Smooth transitions and ensure consistency

### Words Automatically Replaced

The system replaces AI-sounding words like:
- delve, landscape, crucial, leverage, robust
- comprehensive, facilitate, utilize, paramount
- furthermore, additionally, subsequently

## Project Structure

```
article-automation/
├── src/
│   ├── index.ts              # Main pipeline orchestrator
│   ├── services/
│   │   ├── trends.ts         # Topic discovery (RSS/Google/AI)
│   │   ├── openai.ts         # Article generation + competitor analysis
│   │   ├── humanizer.ts      # Content humanization + originality
│   │   ├── readability.ts    # Flesch-Kincaid scoring + optimization
│   │   ├── schema.ts         # JSON-LD schema generation
│   │   ├── unsplash.ts       # Featured image fetching
│   │   └── wordpress.ts      # Publishing + internal linking
│   ├── prompts/
│   │   ├── article.ts        # SEO generation prompts
│   │   └── humanize.ts       # Humanization prompts
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── utils/
│       ├── config.ts         # Configuration loader
│       └── logger.ts         # Logging utility
├── dashboard/                # Next.js web dashboard
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   └── lib/                  # Utilities
├── data/
│   └── history.json          # Article generation history
├── .github/
│   └── workflows/
│       └── publish-article.yml
├── .env.example              # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### "Failed to connect to WordPress"

- Verify `WP_URL` doesn't have a trailing slash
- Check application password is correct (no spaces)
- Ensure REST API is not blocked by security plugins

### "No trending topics found"

- Google Trends may be rate-limited; wait and retry
- Try a different `TRENDS_GEO` region
- Check `TOPIC_SOURCES` configuration
- Verify network connection

### "OpenAI API error"

- Verify API key is valid and has credits
- Check model name is correct (`gpt-4o`, `gpt-4-turbo`, etc.)
- Review rate limits on your OpenAI account

### Articles sound too AI-like

- Adjust `VOICE_PERSONALITY` to be more specific
- Add words to avoid via `VOICE_AVOID_WORDS`
- Check readability scores in logs

### RankMath keyword not showing

- This is expected behavior - RankMath's focus keyword field isn't exposed to REST API by default
- It doesn't affect actual SEO; your keywords are in the content, title, and meta description

## Cost Estimation

Approximate costs per article (using GPT-4o):

| Step | Tokens | Cost |
|------|--------|------|
| Competitor Analysis | ~1000 | ~$0.02 |
| Keywords + Outline | ~1300 | ~$0.03 |
| Content Generation | ~3000 | ~$0.06 |
| Originality Enhancement | ~2000 | ~$0.04 |
| Humanization (2x) | ~6000 | ~$0.12 |
| Readability Pass | ~2000 | ~$0.04 |
| Meta Generation | ~500 | ~$0.01 |
| **Total** | ~15,800 | **~$0.32** |

*Costs vary based on article length and model pricing.*

## License

MIT
