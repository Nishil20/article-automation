# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run build          # Compile TypeScript (tsc) to dist/
npm start              # Run compiled pipeline (dist/index.js)
npm run dev            # Run pipeline with tsx (no build needed)
npm run lint           # ESLint check
npm run typecheck      # TypeScript type checking (tsc --noEmit)
npm run dashboard      # Start Next.js dashboard dev server (port 3000)
npm run dashboard:build # Build dashboard for production
```

Dashboard has its own `package.json` in `dashboard/` — run `npm install` in both root and `dashboard/` directories.

## Architecture

This is an automated SEO article generation and WordPress publishing system with two modules:

1. **Core Pipeline** (`src/`) — Node.js CLI that orchestrates the full article lifecycle: topic discovery → competitor analysis → article generation → humanization → readability optimization → featured image → internal linking → schema markup → WordPress publishing.

2. **Web Dashboard** (`dashboard/`) — Next.js 14 App Router interface for monitoring pipeline status, triggering manual runs, and viewing history.

### Pipeline Flow (src/index.ts)

The `runPipeline()` function executes 11 sequential steps. Each step is a service in `src/services/`. Non-critical steps (featured image, internal links) use graceful degradation — failures don't halt the pipeline. Critical steps use exponential backoff retry (max 3 attempts).

### Key Services

- **`src/services/openai.ts`** — Article generation, competitor analysis, keyword extraction via GPT-4. Tracks cumulative token usage.
- **`src/services/humanizer.ts`** — Multi-pass content rewriting: originality enhancement (replace 29 robotic words), burstiness analysis, AI humanization pass, final polish. Uses voice config (tone/perspective/personality).
- **`src/services/readability.ts`** — Flesch-Kincaid scoring, targets grade level 8-10.
- **`src/services/wordpress.ts`** — REST API publishing with Basic Auth. Sets both Yoast SEO and RankMath meta fields. Handles media upload, internal linking, slug uniqueness.
- **`src/services/trends.ts`** — Topic discovery with fallback chain: RSS → Google Trends → OpenAI suggestions → evergreen topics.
- **`src/services/unsplash.ts`** — Featured image fetching (50 req/hour free tier limit).
- **`src/services/schema.ts`** — Article JSON-LD schema generation.

### Dashboard Real-Time Updates

The dashboard uses Server-Sent Events (SSE) via `PipelineEventEmitter` singleton (`src/services/pipeline-events.ts`). The `/api/status` route streams events; React components consume via `EventSource`.

### Data Persistence

Article history is stored in `data/history.json` — written by `/dashboard/app/api/generate/run/route.ts` after pipeline execution.

## Code Conventions

- **ESM modules** — `"type": "module"` in package.json. All imports use `.js` extensions (e.g., `from './services/openai.js'`).
- **TypeScript strict mode** — `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `forceConsistentCasingInFileNames`. Target ES2022, Module NodeNext.
- **Zod validation** — Config schema validated in `src/utils/config.ts`.
- **Structured logging** — `src/utils/logger.ts` with child loggers (e.g., `[OpenAI]`), configurable via `LOG_LEVEL` env var.
- **GPT prompts** — Centralized in `src/prompts/article.ts` and `src/prompts/humanize.ts`.

## CI/CD

GitHub Actions workflow (`.github/workflows/publish-article.yml`) runs twice daily at 9 AM and 6 PM UTC. Supports manual trigger with `voice_tone` and `dry_run` inputs. Requires secrets: `OPENAI_API_KEY`, `WP_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`. Optional: `UNSPLASH_ACCESS_KEY`.

## Environment

Required env vars: `OPENAI_API_KEY`, `WP_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`. See `.env.example` for all options. Config is loaded and validated via Zod in `src/utils/config.ts`.
