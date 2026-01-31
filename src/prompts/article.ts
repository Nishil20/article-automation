import { VoiceConfig, ArticleKeywords, ArticleOutline, ArticleSection, UniqueAngle, CompetitorAnalysis } from '../types/index.js';

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
- Include 5-7 main sections (H2 headings) that cover the topic comprehensively
- Each section should have 1-3 subheadings (H3) where appropriate
- Use H4/H5 subheadings within complex subsections for deeper structure when warranted
- List 2-4 key points to cover in each section
- Include E-E-A-T signals: sections that demonstrate first-hand experience, cite expert knowledge, and provide authoritative data
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

E-E-A-T REQUIREMENTS:
- Experience: Include first-hand experience markers ("In practice...", "From hands-on testing...", "Based on real-world use...")
- Expertise: Reference specific data points, research findings, or industry-standard methodologies
- Authoritativeness: Cite recognized authorities, standards bodies, or established best practices
- Trustworthiness: Present balanced viewpoints, acknowledge limitations, and use precise language

WRITING REQUIREMENTS:
1. Write 1500-2000 words of high-quality content
2. Format using semantic HTML tags:
   - <h2> for main section headings
   - <h3> for subheadings
   - <h4>, <h5>, <h6> for deeper sub-structure where it aids clarity
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
  keywords: ArticleKeywords,
  recentArticleContext?: string
): string {
  const recentSection = recentArticleContext
    ? `\nRECENTLY PUBLISHED ARTICLES (DO NOT repeat these angles or cover the same ground):\n${recentArticleContext}\n`
    : '';

  return `You are a content strategist creating a unique angle for an article.

TOPIC: "${topic}"
PRIMARY KEYWORD: "${keywords.primary}"
${recentSection}
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
- Include 5-7 main sections (H2 headings) that cover the topic through this unique lens
- Each section should have 1-3 subheadings (H3) where appropriate
- Use H4/H5 subheadings within complex subsections for deeper structure when warranted
- List 2-4 key points per section that reinforce the unique angle
- Include E-E-A-T signals: sections demonstrating experience, expertise, and authoritative data
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

/**
 * Generate an introduction section for an article
 */
export function getIntroductionPrompt(
  title: string,
  keywords: ArticleKeywords,
  voiceConfig: VoiceConfig,
  outlineIntro: string
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

  return `Write the INTRODUCTION for an article titled "${title}".

OUTLINE HOOK: ${outlineIntro}

SEO KEYWORDS:
- Primary: "${keywords.primary}" (MUST appear in the first paragraph)
- Secondary: ${keywords.secondary.join(', ')}

VOICE & TONE:
- Tone: ${voiceConfig.tone} - ${toneGuide[voiceConfig.tone]}
- Perspective: ${voiceConfig.perspective} - ${perspectiveGuide[voiceConfig.perspective]}
- Personality: ${voiceConfig.personality}

REQUIREMENTS:
- Write 150-200 words
- Hook the reader with a compelling opening
- Establish the article's value proposition
- Include the primary keyword naturally in the first 2 sentences
- Use semantic HTML: <p> tags for paragraphs
- Do NOT include any heading tags — just the introduction paragraphs
- Keep paragraphs under 4 sentences

IMPORTANT: Output clean HTML only. No markdown code blocks. No <h2> or <h1> tags.`;
}

/**
 * Generate a single H2 section of an article
 */
export function getSectionGenerationPrompt(
  section: ArticleSection,
  sectionIndex: number,
  totalSections: number,
  keywords: ArticleKeywords,
  voiceConfig: VoiceConfig,
  articleTitle: string
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

  return `Write ONE section of an article titled "${articleTitle}".
This is section ${sectionIndex + 1} of ${totalSections}.

SECTION TO WRITE:
- H2 Heading: "${section.heading}"
${section.subheadings && section.subheadings.length > 0 ? `- H3 Subheadings: ${section.subheadings.join(', ')}` : ''}
- Key Points to Cover: ${section.keyPoints.join('; ')}

SEO KEYWORDS (use naturally, do NOT stuff):
- Primary: "${keywords.primary}" (use 1 time in this section)
- Secondary: ${keywords.secondary.join(', ')} (use 1 if natural)
- LSI Keywords: ${keywords.lsiKeywords.join(', ')} (sprinkle 1-2)

VOICE & TONE:
- Tone: ${voiceConfig.tone} - ${toneGuide[voiceConfig.tone]}
- Perspective: ${voiceConfig.perspective} - ${perspectiveGuide[voiceConfig.perspective]}
- Personality: ${voiceConfig.personality}

E-E-A-T SIGNALS TO INCLUDE:
- First-hand experience markers where natural ("In practice...", "From experience...", "When tested...")
- Specific data points, percentages, or research findings to demonstrate expertise
- Reference authoritative sources or industry standards where relevant

REQUIREMENTS:
- Write 250-400 words for this section (MINIMUM 250 words — this is critical)
- Start with <h2>${section.heading}</h2>
- Use <h3> for any subheadings
- Use <h4> or <h5> for deeper sub-structure within complex subsections if warranted
- Use <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis
- Include specific data, examples, or actionable advice
- Use transition words to connect ideas
- Keep paragraphs under 4 sentences
- Do NOT repeat content from other sections

IMPORTANT: Output clean HTML only. No markdown code blocks. Start with the <h2> tag.`;
}

/**
 * Generate a conclusion section for an article
 */
export function getConclusionPrompt(
  title: string,
  keywords: ArticleKeywords,
  voiceConfig: VoiceConfig,
  outlineConclusion: string
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

  return `Write the CONCLUSION for an article titled "${title}".

OUTLINE CONCLUSION NOTES: ${outlineConclusion}

SEO KEYWORDS:
- Primary: "${keywords.primary}" (include once naturally)

VOICE & TONE:
- Tone: ${voiceConfig.tone} - ${toneGuide[voiceConfig.tone]}
- Perspective: ${voiceConfig.perspective} - ${perspectiveGuide[voiceConfig.perspective]}
- Personality: ${voiceConfig.personality}

REQUIREMENTS:
- Write 150-200 words
- Summarize key takeaways
- End with a clear call-to-action or thought-provoking statement
- Use semantic HTML: <h2>Conclusion</h2> or a more creative heading, then <p> tags
- Keep paragraphs under 4 sentences

IMPORTANT: Output clean HTML only. No markdown code blocks. Start with <h2>.`;
}

/**
 * Expand a section that is too short
 */
export function getSectionExpansionPrompt(
  sectionContent: string,
  sectionHeading: string,
  articleTitle: string,
  keywords: ArticleKeywords
): string {
  return `The following section from the article "${articleTitle}" is too short and needs expansion.

SECTION HEADING: "${sectionHeading}"
CURRENT CONTENT:
${sectionContent}

SEO KEYWORDS:
- Primary: "${keywords.primary}"
- LSI Keywords: ${keywords.lsiKeywords.join(', ')}

REQUIREMENTS:
- Add 100-150 more words to this section
- Add more specific details, examples, statistics, or actionable tips
- Maintain the same HTML structure and tone
- Integrate naturally with the existing content
- Do NOT repeat what's already written

Output the COMPLETE expanded section including the original content and new additions. Clean HTML only. No markdown code blocks.`;
}

/**
 * Generate FAQ questions and answers for an article
 */
export function getFAQGenerationPrompt(
  articleTitle: string,
  articleContent: string,
  keywords: ArticleKeywords
): string {
  return `Generate FAQ (Frequently Asked Questions) for the following article.

ARTICLE TITLE: "${articleTitle}"
PRIMARY KEYWORD: "${keywords.primary}"
SECONDARY KEYWORDS: ${keywords.secondary.join(', ')}

ARTICLE CONTENT PREVIEW:
${articleContent.substring(0, 2000)}...

Generate 6-8 commonly asked questions that:
1. Are genuinely useful questions people search for related to this topic
2. Include the primary keyword naturally in at least 2-3 questions
3. Cover different aspects of the topic (what, how, why, when, comparison, cost, etc.)
4. Have concise, informative answers (2-4 sentences each) that cite authoritative reasoning and demonstrate expertise
5. Would trigger Google's "People Also Ask" featured snippet
6. Demonstrate E-E-A-T: answers should reference credible sources, industry standards, or expert consensus where applicable

Generate a JSON response:
{
  "faqs": [
    {
      "question": "What is...?",
      "answer": "Concise, informative answer here."
    }
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Generate an outline that is cluster-aware (links back to pillar content)
 */
export function getClusterAwareOutlinePrompt(
  topic: string,
  keywords: ArticleKeywords,
  uniqueAngle: UniqueAngle,
  clusterContext: {
    pillarTopic: string;
    existingArticles: Array<{ title: string; slug: string }>;
    contentType: 'pillar' | 'cluster';
  }
): string {
  const clusterInstructions = clusterContext.contentType === 'cluster'
    ? `This is a CLUSTER article supporting the pillar topic "${clusterContext.pillarTopic}".
- Reference and build upon the pillar topic naturally
- Include 1-2 natural mentions where readers should check the pillar article for more depth
- Focus on this specific subtopic while acknowledging the broader context

Existing articles in this cluster:
${clusterContext.existingArticles.map(a => `- "${a.title}"`).join('\n')}`
    : `This is a PILLAR article — the comprehensive guide for the cluster topic "${clusterContext.pillarTopic}".
- Cover the topic broadly and comprehensively
- Create sections that individual cluster articles can dive deeper into
- This should be the most authoritative piece in the cluster`;

  return `Create a detailed article outline for a 1500-2000 word SEO-optimized article with topic cluster awareness.

TOPIC: "${topic}"
PRIMARY KEYWORD: "${keywords.primary}"
SECONDARY KEYWORDS: ${keywords.secondary.join(', ')}
LSI KEYWORDS: ${keywords.lsiKeywords.join(', ')}

UNIQUE ANGLE:
- Angle: ${uniqueAngle.angle}
- Target Audience: ${uniqueAngle.targetAudience}

CLUSTER CONTEXT:
${clusterInstructions}

Requirements:
- Create an engaging title that includes the primary keyword
- Write a compelling introduction (2-3 sentences)
- Include 4-6 main sections (H2 headings)
- Each section should have 1-3 subheadings (H3) where appropriate
- List 2-4 key points per section
- Write a conclusion summary

Generate a JSON response:
{
  "title": "Article title with primary keyword",
  "introduction": "2-3 sentence hook",
  "sections": [
    {
      "heading": "H2 heading text",
      "subheadings": ["H3 subheading 1", "H3 subheading 2"],
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "conclusion": "Summary"
}

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Generate external authoritative links for an article
 */
export function getExternalLinksPrompt(
  title: string,
  content: string,
  keywords: ArticleKeywords
): string {
  return `You are an SEO expert adding authoritative external links to enhance E-E-A-T signals.

ARTICLE TITLE: "${title}"
PRIMARY KEYWORD: "${keywords.primary}"
SECONDARY KEYWORDS: ${keywords.secondary.join(', ')}

ARTICLE CONTENT PREVIEW:
${content.substring(0, 3000)}...

Generate 3-5 authoritative external links that would strengthen this article's credibility and E-E-A-T signals.

LINK SOURCE PRIORITIES (in order):
1. Government sites (.gov)
2. Educational institutions (.edu)
3. Major publications (NYT, BBC, Reuters, Forbes, etc.)
4. Industry-leading organizations and standards bodies
5. Peer-reviewed research or established databases

REQUIREMENTS:
- Each link must be a REAL, well-known, authoritative URL that is highly likely to exist
- Use general domain URLs (e.g., "https://www.cdc.gov", "https://www.who.int") rather than specific deep-linked pages that may not exist
- The anchor text should read naturally in context
- Provide a context sentence showing how the link fits into the article
- Links should support different claims or sections throughout the article
- Do NOT link to competitors, affiliate sites, or low-authority domains

Generate a JSON response:
{
  "links": [
    {
      "url": "https://www.example.gov",
      "anchorText": "natural anchor text for the link",
      "contextSentence": "A sentence where this link would naturally appear in the article."
    }
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}
