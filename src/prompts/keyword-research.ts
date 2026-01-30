/**
 * GPT-4 prompts for keyword research and analysis
 */

/**
 * Estimate search volume, difficulty, and trend for a list of keywords
 */
export function getKeywordMetricsPrompt(keywords: string[], topic: string): string {
  return `You are an SEO expert analyzing keyword metrics for the topic: "${topic}"

KEYWORDS TO ANALYZE:
${keywords.map((k, i) => `${i + 1}. "${k}"`).join('\n')}

For each keyword, estimate:
1. **estimatedVolume**: "high" (10k+/mo), "medium" (1k-10k), "low" (100-1k), or "very_low" (<100)
2. **estimatedDifficulty**: 0-100 score (higher = harder to rank). Consider domain authority needed, SERP competition, and content quality bar.
3. **trend**: "rising" (growing search interest), "stable" (consistent), or "declining" (losing interest)

Base your estimates on your knowledge of typical search patterns, competition levels, and market trends for these types of queries.

Generate a JSON response:
{
  "metrics": [
    {
      "keyword": "the keyword",
      "estimatedVolume": "medium",
      "estimatedDifficulty": 45,
      "trend": "stable"
    }
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Classify search intent for a list of keywords
 */
export function getIntentClassificationPrompt(keywords: string[]): string {
  return `You are an SEO expert classifying search intent for keywords.

KEYWORDS TO CLASSIFY:
${keywords.map((k, i) => `${i + 1}. "${k}"`).join('\n')}

Classify each keyword's primary search intent:
- **informational**: User wants to learn something (how to, what is, guide, tutorial)
- **transactional**: User wants to buy/act (buy, order, download, sign up)
- **navigational**: User wants a specific site/page (brand name, login, specific product)
- **commercial**: User is researching before a purchase (best, review, comparison, vs)

Generate a JSON response:
{
  "classifications": [
    {
      "keyword": "the keyword",
      "intent": "informational"
    }
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Generate additional long-tail keyword variations
 */
export function getLongTailExpansionPrompt(
  primaryKeyword: string,
  existingLongTails: string[]
): string {
  return `You are an SEO keyword research expert expanding long-tail variations.

PRIMARY KEYWORD: "${primaryKeyword}"

EXISTING LONG-TAIL KEYWORDS (do NOT repeat these):
${existingLongTails.map(k => `- "${k}"`).join('\n')}

Generate 8-12 additional long-tail keyword variations that:
1. Are 4-8 words long
2. Target specific user questions or needs
3. Have lower competition than the primary keyword
4. Cover different search intents (how-to, comparison, specific use cases)
5. Would naturally fit into article content

Generate a JSON response:
{
  "longTails": [
    "long tail keyword variation 1",
    "long tail keyword variation 2"
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Analyze keyword cannibalization risk for multiple candidates against existing content (batched)
 */
export function getCannibalizationAnalysisPrompt(
  candidateKeywords: string[],
  existingArticles: Array<{ title: string; slug: string; keywords: string[] }>
): string {
  return `You are an SEO expert analyzing keyword cannibalization risk.

CANDIDATE KEYWORDS:
${candidateKeywords.map((k, i) => `${i + 1}. "${k}"`).join('\n')}

EXISTING ARTICLES:
${existingArticles.map((a, i) => `${i + 1}. Title: "${a.title}" | Slug: "${a.slug}" | Keywords: ${a.keywords.join(', ')}`).join('\n')}

For each candidate keyword, analyze whether it would compete with any existing articles for the same search results.

For each potentially overlapping article, assess:
1. **similarity**: 0-1 score of how much the keyword overlaps with the article's target
2. **matchedKeywords**: Which existing keywords overlap
3. **isCannibalized**: true if similarity > 0.6 (significant overlap that could hurt rankings)

If cannibalized, suggest 2-3 long-tail alternatives that would differentiate from existing content.

Generate a JSON response:
{
  "results": [
    {
      "keyword": "candidate keyword",
      "overlappingArticles": [
        {
          "title": "Existing article title",
          "slug": "existing-slug",
          "similarity": 0.7,
          "matchedKeywords": ["keyword1", "keyword2"]
        }
      ],
      "isCannibalized": true,
      "suggestedLongTails": ["alternative 1", "alternative 2"]
    }
  ]
}

For keywords with no overlap, set overlappingArticles to [], isCannibalized to false, and suggestedLongTails to [].

Respond ONLY with valid JSON, no additional text.`;
}
