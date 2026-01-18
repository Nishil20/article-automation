# Article Automation System

Automated SEO article generation and WordPress publishing system. This pipeline discovers trending topics via Google Trends, generates humanized SEO-optimized articles using OpenAI GPT-4, and publishes them to WordPress—all without manual intervention.

## Features

- **Trending Topic Discovery**: Automatically fetches trending topics from Google Trends
- **SEO-Optimized Content**: Generates articles with proper keyword targeting, structure, and meta tags
- **Human-Like Writing**: Multi-pass humanization pipeline that makes AI content sound natural
- **Featured Images**: Automatically adds relevant stock photos from Unsplash as featured images
- **WordPress Integration**: Publishes directly via REST API with Yoast SEO support
- **Scheduled Automation**: Runs on GitHub Actions cron for hands-free operation
- **Configurable Voice**: Customize tone, perspective, and personality

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Google Trends  │────▶│  OpenAI GPT-4   │────▶│   Humanizer     │────▶│   WordPress     │
│  (Topic Source) │     │  (Generation)   │     │  (Refinement)   │     │  (Publishing)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                                                  │
                                                ┌─────────────────┐               │
                                                │    Unsplash     │───────────────┘
                                                │ (Featured Image)│
                                                └─────────────────┘
```

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd article-automation
npm install
```

### 2. Configure Environment

Create a `.env` file with your credentials:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o

# WordPress Configuration
WP_URL=https://your-wordpress-site.com
WP_USERNAME=your-username
WP_APP_PASSWORD=your-application-password
WP_CATEGORY=Uncategorized

# Google Trends Configuration
TRENDS_GEO=US
TRENDS_CATEGORY=all

# Unsplash Configuration (for featured images)
UNSPLASH_ACCESS_KEY=your-unsplash-access-key
UNSPLASH_ENABLED=true

# Voice Configuration
VOICE_TONE=conversational
VOICE_PERSPECTIVE=second_person
VOICE_PERSONALITY=friendly expert who uses analogies and real-world examples
```

### 3. Run Locally

```bash
# Build TypeScript
npm run build

# Run the pipeline
npm start

# Or use dev mode (no build required)
npm run dev
```

## WordPress Setup

### Generate Application Password

1. Log in to WordPress admin
2. Go to **Users → Profile**
3. Scroll to **Application Passwords**
4. Enter a name (e.g., "Article Automation")
5. Click **Add New Application Password**
6. Copy the generated password (shown only once)

### Enable REST API

The WordPress REST API is enabled by default. If you're using security plugins, ensure these endpoints are accessible:

- `POST /wp-json/wp/v2/posts`
- `GET /wp-json/wp/v2/categories`
- `GET /wp-json/wp/v2/users/me`

### Yoast SEO Integration (Optional)

If you have Yoast SEO installed, the system will automatically set:
- SEO Title (`_yoast_wpseo_title`)
- Meta Description (`_yoast_wpseo_metadesc`)

## Unsplash Setup (Optional)

To automatically add featured images to articles:

### 1. Create an Unsplash Developer Account

1. Go to [Unsplash Developers](https://unsplash.com/developers)
2. Click "Register as a developer"
3. Create a new application
4. Copy your **Access Key** (not the Secret Key)

### 2. Configure

Add to your `.env` file:

```env
UNSPLASH_ACCESS_KEY=your-access-key-here
UNSPLASH_ENABLED=true
```

### Rate Limits

The free tier allows 50 requests/hour, which is plenty for article automation. The system searches for images using the article's primary keyword and falls back to the topic title if no results are found.

### Attribution

Unsplash requires attribution for images. The system stores photographer information in the article metadata. Consider adding photo credits to your articles.

## GitHub Actions Setup

### 1. Add Repository Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `WP_URL` | WordPress site URL (e.g., `https://example.com`) |
| `WP_USERNAME` | WordPress username |
| `WP_APP_PASSWORD` | WordPress application password |
| `UNSPLASH_ACCESS_KEY` | (Optional) Unsplash API access key for featured images |

### 2. Add Repository Variables (Optional)

Under **Variables**, you can customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model to use |
| `WP_CATEGORY` | `Uncategorized` | Default post category |
| `TRENDS_GEO` | `US` | Google Trends geography |
| `TRENDS_CATEGORY` | `all` | Topic category filter |
| `VOICE_TONE` | `conversational` | Writing tone |
| `VOICE_PERSPECTIVE` | `second_person` | POV (first/second/third) |
| `VOICE_PERSONALITY` | `friendly expert...` | Custom persona |

### 3. Schedule

The workflow runs daily at 9 AM UTC by default. Modify the cron in `.github/workflows/publish-article.yml`:

```yaml
schedule:
  - cron: '0 9 * * *'  # Daily at 9 AM UTC
  - cron: '0 9,21 * * *'  # Twice daily
  - cron: '0 9 * * 1-5'  # Weekdays only
```

### 4. Manual Trigger

You can also trigger manually from the Actions tab with custom options.

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

Set `VOICE_PERSONALITY` to describe your ideal writer:

```
VOICE_PERSONALITY=witty tech journalist who explains complex topics with pop culture references
```

## Humanization Pipeline

The system uses a multi-pass approach to make AI content sound natural:

1. **Quick Word Replacement**: Replaces robotic words (utilize → use, leverage → take advantage of)
2. **Burstiness Analysis**: Measures sentence length variance
3. **AI Humanization Pass**: Rewrites for natural flow, contractions, rhetorical questions
4. **Pattern Analysis**: Scores content for AI-like patterns
5. **Final Polish**: Smooths transitions and ensures consistency

### Words Automatically Replaced

The system automatically replaces AI-sounding words like:
- delve, landscape, crucial, leverage, robust
- comprehensive, facilitate, utilize, paramount
- furthermore, additionally, subsequently

## Project Structure

```
article-automation/
├── src/
│   ├── index.ts              # Main orchestrator
│   ├── services/
│   │   ├── trends.ts         # Google Trends integration
│   │   ├── openai.ts         # Article generation
│   │   ├── humanizer.ts      # Content humanization
│   │   ├── unsplash.ts       # Featured image fetching
│   │   └── wordpress.ts      # WordPress publishing
│   ├── prompts/
│   │   ├── article.ts        # SEO generation prompts
│   │   └── humanize.ts       # Humanization prompts
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── utils/
│       ├── config.ts         # Configuration loader
│       └── logger.ts         # Logging utility
├── .github/
│   └── workflows/
│       └── publish-article.yml
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
- Check your network connection

### "OpenAI API error"

- Verify API key is valid and has credits
- Check model name is correct
- Review rate limits on your OpenAI account

### Articles sound too AI-like

- Increase humanization passes in `humanizer.ts`
- Adjust `VOICE_PERSONALITY` to be more specific
- Add more words to avoid list in `config.ts`

## Cost Estimation

Approximate costs per article (using GPT-4o):

| Step | Tokens | Cost |
|------|--------|------|
| Keywords | ~500 | ~$0.01 |
| Outline | ~800 | ~$0.02 |
| Content | ~3000 | ~$0.06 |
| Humanize (2x) | ~6000 | ~$0.12 |
| Meta | ~500 | ~$0.01 |
| **Total** | ~10,800 | **~$0.22** |

*Costs vary based on article length and model pricing.*

## License

MIT
