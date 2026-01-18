import { VoiceConfig } from '../types/index.js';

/**
 * Main humanization prompt to transform AI content into natural human writing
 */
export function getHumanizationPrompt(
  content: string,
  voiceConfig: VoiceConfig
): string {
  const avoidWordsList = voiceConfig.avoidWords.slice(0, 20).join(', ');
  const preferredPhrasesList = voiceConfig.preferredPhrases.slice(0, 10).join('", "');

  return `You are an expert editor who transforms AI-generated content into natural, human-written prose.
Your goal is to make this article sound like it was written by a real person, not an AI.

ORIGINAL ARTICLE:
${content}

HUMANIZATION RULES:

1. SENTENCE VARIETY (Burstiness)
   - Mix sentence lengths dramatically
   - Include some very short sentences (3-7 words): "That's the key." "It works."
   - Include some longer, flowing sentences (20-30 words)
   - Vary sentence openings - don't start consecutive sentences the same way

2. NATURAL LANGUAGE
   - Use contractions naturally: "you're", "it's", "doesn't", "won't", "can't"
   - Add conversational interjections: "well", "actually", "honestly", "look"
   - Include rhetorical questions (2-3 throughout): "So what does this mean for you?"
   
3. REPLACE AI-SOUNDING WORDS
   Replace these robotic words with natural alternatives:
   ${avoidWordsList}
   
   Examples:
   - "utilize" → "use"
   - "leverage" → "use" or "take advantage of"
   - "crucial" → "important" or "key"
   - "comprehensive" → "complete" or "full"
   - "facilitate" → "help" or "make easier"
   - "robust" → "strong" or "solid"
   - "delve" → "explore" or "look at"
   - "landscape" → "world" or "space" or "field"

4. ADD HUMAN TOUCHES
   - Include 1-2 light opinions: "This is arguably the best approach"
   - Add transitional phrases humans use: "${preferredPhrasesList}"
   - Make numbers specific when possible: "47%" instead of "about 50%"
   - Include occasional hedging: "in most cases", "generally speaking"

5. IMPERFECT TRANSITIONS
   Replace robotic transitions like:
   - "Furthermore" → "And here's the thing" or "Plus"
   - "Additionally" → "On top of that" or "Also"
   - "In conclusion" → "So" or "The bottom line"
   - "It is important to note" → "Worth mentioning:" or "Keep in mind"

6. VOICE SETTINGS
   - Tone: ${voiceConfig.tone}
   - Perspective: ${voiceConfig.perspective}
   - Personality: ${voiceConfig.personality}

CRITICAL REQUIREMENTS:
- Keep ALL HTML structure intact (<h2>, <h3>, <p>, <ul>, <li>, <strong>)
- Preserve SEO keywords and their placement
- Maintain the same overall meaning and information
- Keep the same approximate length (within 10%)
- Do NOT add markdown formatting - output clean HTML only

Output the humanized article as HTML content only.`;
}

/**
 * Analysis prompt to identify AI patterns in text
 */
export function getAIPatternAnalysisPrompt(content: string): string {
  return `Analyze the following text for AI-generated patterns and provide specific suggestions.

TEXT:
${content}

Identify and list:
1. Overused or robotic words that should be replaced
2. Sentences that are too uniform in length
3. Repetitive sentence structures or openings
4. Missing natural language elements (contractions, interjections)
5. Transitions that sound artificial
6. Any patterns that make it obvious this was AI-generated

Format your response as JSON:
{
  "roboticWords": ["word1", "word2"],
  "uniformSentences": ["sentence that needs variation"],
  "repetitiveStructures": ["pattern identified"],
  "missingElements": ["contractions", "rhetorical questions"],
  "artificialTransitions": ["Furthermore,", "Additionally,"],
  "overallScore": 1-10 (1 = very AI, 10 = very human),
  "suggestions": ["specific suggestion 1", "specific suggestion 2"]
}

Respond ONLY with valid JSON.`;
}

/**
 * Prompt to add specific human elements
 */
export function getHumanElementsPrompt(voiceConfig: VoiceConfig): string {
  return `Add natural human elements to writing while maintaining the ${voiceConfig.tone} tone.

Elements to incorporate:
- Occasional informal expressions
- Light humor where appropriate  
- Personal observations (e.g., "I've found that...", "In my experience...")
- Acknowledgment of complexity ("It's not always straightforward, but...")
- Empathy with reader ("You've probably experienced this too")
- Mild self-correction ("Actually, let me rephrase that")

Personality to embody: ${voiceConfig.personality}`;
}

/**
 * Prompt for final polish pass
 */
export function getFinalPolishPrompt(content: string): string {
  return `Give this article a final polish to ensure it reads naturally.

ARTICLE:
${content}

FINAL CHECKS:
1. Read through for flow - does each paragraph lead naturally to the next?
2. Check for any remaining robotic phrases
3. Ensure variety in sentence openings within each paragraph
4. Verify the conclusion feels satisfying, not abrupt
5. Make sure the tone is consistent throughout

Make minimal, targeted edits only where needed. Preserve the HTML structure exactly.

Output the polished article as HTML content only.`;
}

/**
 * Vocabulary enhancement suggestions
 */
export const WORD_REPLACEMENTS: Record<string, string[]> = {
  'utilize': ['use', 'employ', 'work with'],
  'leverage': ['use', 'take advantage of', 'tap into'],
  'crucial': ['important', 'key', 'vital', 'essential'],
  'robust': ['strong', 'solid', 'reliable', 'sturdy'],
  'comprehensive': ['complete', 'full', 'thorough', 'in-depth'],
  'facilitate': ['help', 'make easier', 'enable', 'support'],
  'delve': ['explore', 'dig into', 'look at', 'examine'],
  'landscape': ['world', 'space', 'field', 'arena'],
  'paradigm': ['model', 'approach', 'way of thinking'],
  'synergy': ['teamwork', 'collaboration', 'combined effect'],
  'streamline': ['simplify', 'speed up', 'make efficient'],
  'optimize': ['improve', 'fine-tune', 'make better'],
  'implement': ['use', 'put in place', 'set up', 'start using'],
  'subsequently': ['then', 'after that', 'later'],
  'consequently': ['so', 'as a result', 'because of this'],
  'furthermore': ['plus', 'also', 'and', 'on top of that'],
  'additionally': ['also', 'plus', 'and', 'besides'],
  'nevertheless': ['still', 'even so', 'but', 'yet'],
  'aforementioned': ['this', 'that', 'the'],
  'endeavor': ['try', 'attempt', 'effort', 'work'],
  'ascertain': ['find out', 'learn', 'discover', 'figure out'],
  'pertaining': ['about', 'related to', 'regarding'],
  'commenced': ['started', 'began', 'kicked off'],
  'terminated': ['ended', 'stopped', 'finished'],
  'sufficient': ['enough', 'plenty of', 'adequate'],
  'numerous': ['many', 'lots of', 'several', 'a bunch of'],
  'possess': ['have', 'own', 'hold'],
  'obtain': ['get', 'find', 'pick up'],
  'require': ['need', 'must have', 'call for'],
  'demonstrate': ['show', 'prove', 'display'],
  'indicate': ['show', 'suggest', 'point to'],
  'assist': ['help', 'support', 'aid'],
  'acquire': ['get', 'gain', 'pick up'],
  'initiate': ['start', 'begin', 'kick off'],
};

/**
 * Natural transition phrases to use instead of robotic ones
 */
export const NATURAL_TRANSITIONS = {
  addition: [
    'Plus,', 'And here\'s the thing:', 'On top of that,', 'Also,',
    'What\'s more,', 'Not only that, but', 'And get this:',
  ],
  contrast: [
    'But here\'s where it gets interesting:', 'That said,', 'On the flip side,',
    'However,', 'Still,', 'Yet,', 'But wait:',
  ],
  cause: [
    'So,', 'That\'s why', 'This means', 'As a result,',
    'Because of this,', 'Which explains why',
  ],
  example: [
    'Take this:', 'Here\'s an example:', 'Like this:', 'Picture this:',
    'Say you\'re', 'Imagine', 'Consider this:',
  ],
  conclusion: [
    'So,', 'The bottom line:', 'Here\'s what it comes down to:',
    'At the end of the day,', 'What does this all mean?',
  ],
};
