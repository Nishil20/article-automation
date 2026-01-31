/**
 * Content utility functions for FAQ rendering, Table of Contents generation,
 * and external link injection
 */

import { ExternalLink } from '../types/index.js';

export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Render FAQ items as an HTML section with microdata attributes for SEO
 */
export function renderFAQSection(faqs: FAQItem[]): string {
  if (faqs.length === 0) return '';

  const faqItems = faqs
    .map(
      (faq) => `  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">${escapeHtml(faq.question)}</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">${escapeHtml(faq.answer)}</p>
    </div>
  </div>`
    )
    .join('\n');

  return `<section itemscope itemtype="https://schema.org/FAQPage">
<h2>Frequently Asked Questions</h2>
${faqItems}
</section>`;
}

export interface TOCResult {
  tocHtml: string;
  contentWithIds: string;
}

/**
 * Generate a Table of Contents from HTML content
 * Parses H2 and H3 headings, adds id attributes, and builds a nav element
 */
export function generateTableOfContents(htmlContent: string): TOCResult {
  const headingRegex = /<(h[23])>(.*?)<\/\1>/gi;
  const headings: Array<{ level: number; text: string; slug: string }> = [];

  // Collect all headings
  let match;
  while ((match = headingRegex.exec(htmlContent)) !== null) {
    const level = parseInt(match[1].charAt(1));
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const slug = generateSlug(text);
    headings.push({ level, text, slug });
  }

  if (headings.length === 0) {
    return { tocHtml: '', contentWithIds: htmlContent };
  }

  // Inject id attributes into headings in the content
  let contentWithIds = htmlContent;
  const slugCounts = new Map<string, number>();

  for (const heading of headings) {
    // Handle duplicate slugs
    const count = slugCounts.get(heading.slug) || 0;
    const uniqueSlug = count > 0 ? `${heading.slug}-${count}` : heading.slug;
    slugCounts.set(heading.slug, count + 1);
    heading.slug = uniqueSlug;

    // Replace the first occurrence of this heading without an id
    const tag = `h${heading.level}`;
    const headingPattern = new RegExp(
      `<${tag}>(${escapeRegex(heading.text)})</${tag}>`,
      'i'
    );
    contentWithIds = contentWithIds.replace(
      headingPattern,
      `<${tag} id="${uniqueSlug}">$1</${tag}>`
    );
  }

  // Build TOC HTML as nested list
  let tocItems = '';
  let currentLevel = 2;

  for (const heading of headings) {
    if (heading.level === 2) {
      if (currentLevel === 3) {
        tocItems += '</ol></li>\n';
      }
      tocItems += `<li><a href="#${heading.slug}">${escapeHtml(heading.text)}</a>`;
      currentLevel = 2;
    } else if (heading.level === 3) {
      if (currentLevel === 2) {
        tocItems += '\n<ol>\n';
      }
      tocItems += `<li><a href="#${heading.slug}">${escapeHtml(heading.text)}</a></li>\n`;
      currentLevel = 3;
    }
  }

  // Close any remaining open tags
  if (currentLevel === 3) {
    tocItems += '</ol></li>\n';
  } else {
    tocItems += '</li>\n';
  }

  const tocHtml = `<nav class="table-of-contents" aria-label="Table of Contents">
<h2>Table of Contents</h2>
<ol>
${tocItems}</ol>
</nav>`;

  return { tocHtml, contentWithIds };
}

/**
 * Generate a URL-friendly slug from text
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Inject external authoritative links into HTML content.
 * Distributes links across <p> tags, max 1 external link per ~300 words.
 */
export function injectExternalLinks(
  htmlContent: string,
  links: ExternalLink[]
): string {
  if (links.length === 0) return htmlContent;

  // Count total words to determine max links
  const plainText = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const totalWords = plainText.split(/\s+/).length;
  const maxLinks = Math.max(1, Math.floor(totalWords / 300));
  const linksToInsert = links.slice(0, Math.min(links.length, maxLinks));

  // Collect all <p>...</p> segments with their positions
  const pTagRegex = /<p>([\s\S]*?)<\/p>/gi;
  const paragraphs: Array<{ start: number; end: number; content: string }> = [];
  let pMatch;
  while ((pMatch = pTagRegex.exec(htmlContent)) !== null) {
    paragraphs.push({
      start: pMatch.index,
      end: pMatch.index + pMatch[0].length,
      content: pMatch[0],
    });
  }

  if (paragraphs.length === 0) return htmlContent;

  // Evenly distribute links across paragraphs (skip first and last)
  const usableParagraphs = paragraphs.slice(1, -1).length > 0
    ? paragraphs.slice(1, -1)
    : paragraphs;

  const step = Math.max(1, Math.floor(usableParagraphs.length / linksToInsert.length));
  const replacements: Array<{ original: string; replacement: string }> = [];

  for (let i = 0; i < linksToInsert.length; i++) {
    const pIdx = Math.min(i * step, usableParagraphs.length - 1);
    const para = usableParagraphs[pIdx];
    const link = linksToInsert[i];

    // Skip paragraphs that already contain external links
    if (para.content.includes('target="_blank"')) continue;

    // Try to find the anchor text in the paragraph for inline placement
    const anchorEscaped = escapeRegex(link.anchorText);
    const anchorRegex = new RegExp(`(${anchorEscaped})`, 'i');

    if (anchorRegex.test(para.content)) {
      // Replace first occurrence of anchor text with a link
      const updated = para.content.replace(
        anchorRegex,
        `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">$1</a>`
      );
      replacements.push({ original: para.content, replacement: updated });
    } else {
      // Append a contextual sentence with the link before the closing </p>
      const linkHtml = `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.anchorText)}</a>`;
      const updated = para.content.replace(
        /<\/p>$/i,
        ` According to ${linkHtml}, this is supported by current research.</p>`
      );
      replacements.push({ original: para.content, replacement: updated });
    }
  }

  // Apply replacements (each original should be unique since paragraphs differ)
  let result = htmlContent;
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }

  return result;
}
