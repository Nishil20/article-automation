import { VoiceConfig, ArticleKeywords, ArticleOutline, UniqueAngle, CompetitorAnalysis } from '../types/index.js';

/**
 * System prompt for consistent AI behavior
 */
export const SYSTEM_PROMPT = `You are an expert SEO content writer with years of experience creating 
engaging, well-researched articles that rank well on search engines. You write in a natural, 
human voice that connects with readers while strategically incorporating keywords for SEO.

Key principles:
- Write for humans first, search engines second
- Use clear, accessible language
- Back up claims with specifics
- Create scannable content with clear structure
- Engage readers with questions and direct address`;

/**
 * Generate keywords from a topic
 */
export function getKeywordGenerationPrompt(
  topic: string,
  relatedQueries: string[]
): string {
  return `Analyze the following topic and generate SEO keywords for an article.

Topic: "${topic}"
Related search queries: ${relatedQueries.slice(0, 10).join(', ')}

Generate a JSON response with:
1. "primary" - The main target keyword (2-4 words, high search intent)
2. "secondary" - Array of 3-5 secondary keywords (variations and related terms)
3. "lsiKeywords" - Array of 5-8 LSI (Latent Semantic Indexing) keywords that are semantically related

Example format:
{
  "primary": "best wireless headphones",
  "secondary": ["wireless headphone reviews", "top bluetooth headphones", "wireless earbuds comparison"],
  "lsiKeywords": ["audio quality", "battery life", "noise cancellation", "comfortable fit", "sound isolation"]
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Generate article outline
 */
export function getOutlineGenerationPrompt(
  topic: string,
  keywords: ArticleKeywords
): string {
  return `Create a detailed article outline for a 1500-2000 word SEO-optimized article.

Topic: "${topic}"
Primary Keyword: "${keywords.primary}"
Secondary Keywords: ${keywords.secondary.join(', ')}
LSI Keywords: ${keywords.lsiKeywords.join(', ')}

Requirements:
- Create an engaging title that includes the primary keyword naturally
- Write a compelling introduction hook (2-3 sentences)
- Include 4-6 main sections (H2 headings) that cover the topic comprehensively
- Each section should have 1-3 subheadings (H3) where appropriate
- List 2-4 key points to cover in each section
- Write a conclusion summary

Generate a JSON response:
{
  "title": "Article title with primary keyword",
  "introduction": "2-3 sentence hook that draws readers in",
  "sections": [
    {
      "heading": "H2 heading text",
      "subheadings": ["H3 subheading 1", "H3 subheading 2"],
      "keyPoints": ["Point to cover 1", "Point to cover 2", "Point to cover 3"]
    }
  ],
  "conclusion": "Brief summary of what the conclusion should cover"
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Generate full article content
 */
export function getArticleGenerationPrompt(
  outline: ArticleOutline,
  keywords: ArticleKeywords,
  voiceConfig: VoiceConfig
): string {
  const perspectiveGuide = {
    first_person: 'Use "I" and "we" - share personal insights and experiences',
    second_person: 'Address the reader directly with "you" and "your"',
    third_person: 'Use neutral, informative language without personal pronouns',
  };

  const toneGuide = {
    conversational: 'Write like you\'re talking to a friend - relaxed but informative',
    professional: 'Maintain authority and expertise while remaining accessible',
    casual: 'Keep it light, fun, and easy to read - like a blog post',
    authoritative: 'Position as the definitive resource on this topic',
  };

  return `Write a complete SEO-optimized article based on the following outline.

OUTLINE:
${JSON.stringify(outline, null, 2)}

SEO KEYWORDS:
- Primary: "${keywords.primary}" (use 3-5 times naturally throughout)
- Secondary: ${keywords.secondary.join(', ')} (use each 1-2 times)
- LSI Keywords: ${keywords.lsiKeywords.join(', ')} (sprinkle throughout for semantic relevance)

VOICE & TONE:
- Tone: ${voiceConfig.tone} - ${toneGuide[voiceConfig.tone]}
- Perspective: ${voiceConfig.perspective} - ${perspectiveGuide[voiceConfig.perspective]}
- Personality: ${voiceConfig.personality}

WRITING REQUIREMENTS:
1. Write 1500-2000 words of high-quality content
2. Format using semantic HTML tags:
   - <h2> for main section headings
   - <h3> for subheadings
   - <p> for paragraphs
   - <ul>/<li> for bullet lists
   - <strong> for emphasis on important terms
3. Include the primary keyword in the first paragraph
4. Use transition words to connect ideas smoothly
5. Add specific data, statistics, or examples where relevant
6. End with a clear call-to-action or thought-provoking conclusion

AVOID:
- Generic filler content
- Overly long paragraphs (keep under 4 sentences)
- Starting multiple sentences with the same word
- Excessive use of the primary keyword (no keyword stuffing)

IMPORTANT: Output the article as clean HTML content only.
- Do NOT wrap in markdown code blocks (no \`\`\`html or \`\`\`)
- Do NOT include <html>, <head>, or <body> tags
- Start directly with the article content (first <h2> or <p> tag)`;
}

/**
 * Generate meta information
 */
export function getMetaGenerationPrompt(
  title: string,
  content: string,
  keywords: ArticleKeywords
): string {
  return `Generate SEO metadata for the following article.

Title: "${title}"
Primary Keyword: "${keywords.primary}"
Article Preview: "${content.substring(0, 500)}..."

Generate a JSON response with:
1. "metaTitle" - SEO title tag (50-60 characters, includes primary keyword near the beginning)
2. "metaDescription" - Meta description (150-155 characters, includes primary keyword, has a call-to-action)
3. "slug" - URL-friendly slug (lowercase, hyphenated, 3-6 words, includes primary keyword)
4. "excerpt" - Article excerpt for WordPress (1-2 sentences, compelling summary)

Example format:
{
  "metaTitle": "Best Wireless Headphones 2024: Top 10 Picks Reviewed",
  "metaDescription": "Discover the best wireless headphones of 2024. Our expert reviews cover sound quality, comfort, and value. Find your perfect pair today!",
  "slug": "best-wireless-headphones-2024",
  "excerpt": "Looking for the perfect wireless headphones? We've tested dozens to bring you the top 10 picks for every budget and use case."
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Analyze competitors for a topic to find content gaps and opportunities
 */
export function getCompetitorAnalysisPrompt(
  topic: string,
  relatedQueries: string[]
): string {
  return `You are an SEO expert analyzing the competitive landscape for a content topic.

TOPIC: "${topic}"
RELATED SEARCHES: ${relatedQueries.slice(0, 10).join(', ')}

Based on your knowledge of typical content that ranks for this topic, analyze what competitors typically cover.

Identify:
1. COMMON TOPICS - What do most articles about this topic always cover? (the obvious stuff)
2. CONTENT GAPS - What important aspects are often missing or underexplored?
3. UNIQUE OPPORTUNITIES - Fresh angles, perspectives, or subtopics that could differentiate new content
4. DEPTH ASSESSMENT - Are most articles shallow overviews or deep dives?
5. KEY DIFFERENTIATORS - What makes the best-performing content stand out?

Generate a JSON response:
{
  "commonTopics": ["topic 1", "topic 2", "topic 3"],
  "contentGaps": ["gap 1", "gap 2", "gap 3"],
  "uniqueOpportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "averageDepth": "shallow" | "medium" | "deep",
  "keyDifferentiators": ["differentiator 1", "differentiator 2"]
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Generate a unique angle based on competitor analysis
 */
export function getUniqueAnglePrompt(
  topic: string,
  competitorAnalysis: CompetitorAnalysis,
  keywords: ArticleKeywords
): string {
  return `You are a content strategist creating a unique angle for an article.

TOPIC: "${topic}"
PRIMARY KEYWORD: "${keywords.primary}"

COMPETITOR ANALYSIS:
- What competitors commonly cover: ${competitorAnalysis.commonTopics.join(', ')}
- Content gaps found: ${competitorAnalysis.contentGaps.join(', ')}
- Unique opportunities: ${competitorAnalysis.uniqueOpportunities.join(', ')}
- Competitor depth: ${competitorAnalysis.averageDepth}

Your task: Generate a UNIQUE ANGLE that will make this article stand out from competitors.

The angle should:
- Fill one or more content gaps identified
- Provide genuine value not found elsewhere
- Be specific and actionable, not vague
- Appeal to a clear target audience
- Be achievable within a 1500-2000 word article

Generate a JSON response:
{
  "angle": "A clear, specific angle statement (1-2 sentences)",
  "reasoning": "Why this angle works and fills a gap",
  "targetAudience": "Who will find this angle most valuable",
  "toneAdjustment": "Any tone adjustments needed for this angle (optional)"
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Enhanced outline generation that incorporates unique angle
 */
export function getOutlineWithAnglePrompt(
  topic: string,
  keywords: ArticleKeywords,
  uniqueAngle: UniqueAngle
): string {
  return `Create a detailed article outline for a 1500-2000 word SEO-optimized article with a UNIQUE ANGLE.

TOPIC: "${topic}"
PRIMARY KEYWORD: "${keywords.primary}"
SECONDARY KEYWORDS: ${keywords.secondary.join(', ')}
LSI KEYWORDS: ${keywords.lsiKeywords.join(', ')}

UNIQUE ANGLE TO INCORPORATE:
- Angle: ${uniqueAngle.angle}
- Target Audience: ${uniqueAngle.targetAudience}
- Reasoning: ${uniqueAngle.reasoning}
${uniqueAngle.toneAdjustment ? `- Tone Adjustment: ${uniqueAngle.toneAdjustment}` : ''}

Requirements:
- Create an engaging title that includes the primary keyword AND hints at the unique angle
- Write a compelling introduction that immediately establishes the unique perspective
- Structure sections to deliver on the unique angle's promise
- Include 4-6 main sections (H2 headings) that cover the topic through this unique lens
- Each section should have 1-3 subheadings (H3) where appropriate
- List 2-4 key points per section that reinforce the unique angle
- Conclusion should tie back to the unique value provided

Generate a JSON response:
{
  "title": "Article title with primary keyword and unique angle hook",
  "introduction": "2-3 sentence hook that establishes the unique perspective",
  "sections": [
    {
      "heading": "H2 heading text",
      "subheadings": ["H3 subheading 1", "H3 subheading 2"],
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "conclusion": "Summary emphasizing the unique value delivered"
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Check content originality and suggest improvements
 */
export function getOriginalityCheckPrompt(content: string): string {
  return `You are an expert editor analyzing content for originality and uniqueness.

CONTENT TO ANALYZE:
${content}

Analyze this content for:
1. GENERIC PHRASES - Common, overused phrases that appear in every article on this topic
2. CLICHÉS - Tired expressions and metaphors that feel stale
3. UNIQUE ELEMENTS - What makes this content genuinely different or valuable
4. ORIGINALITY SCORE - How original is this content overall (0-100)?

For each generic phrase or cliché found, consider if it weakens the content's uniqueness.

Generate a JSON response:
{
  "overallScore": 75,
  "genericPhrases": [
    "phrase 1 that is too common",
    "phrase 2 that is generic"
  ],
  "cliches": [
    "clichéd expression 1",
    "tired metaphor 2"
  ],
  "uniqueElements": [
    "what makes this content stand out 1",
    "unique perspective or insight 2"
  ],
  "suggestions": [
    "specific suggestion to improve originality 1",
    "specific suggestion 2"
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Rewrite content to improve originality
 */
export function getOriginalityImprovementPrompt(
  content: string,
  genericPhrases: string[],
  cliches: string[],
  suggestions: string[]
): string {
  return `You are an expert editor improving content originality.

CONTENT TO IMPROVE:
${content}

ISSUES TO FIX:
- Generic phrases to replace: ${genericPhrases.join(', ')}
- Clichés to eliminate: ${cliches.join(', ')}

IMPROVEMENT SUGGESTIONS:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Your task:
1. Replace generic phrases with more specific, original alternatives
2. Rewrite clichéd expressions with fresh language
3. Maintain the same HTML structure and formatting
4. Keep the SEO keywords and overall meaning intact
5. Make the content feel more unique and valuable

Output the improved HTML content only. Do NOT wrap in markdown code blocks.`;
}
