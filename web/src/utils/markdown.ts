/**
 * Utility to strip markdown syntax and extract clean plain text for card previews,
 * summaries, and meta descriptions.
 */
export function stripMarkdown(markdown?: string | null): string {
  if (!markdown) return '';

  let text = markdown;

  // 1. Remove markdown images: ![alt](url)
  text = text.replace(/!\[.*?\]\(.*?\)/g, '');

  // 2. Convert markdown links: [text](url) -> text
  text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  // 3. Remove raw URLs or malformed image strings (e.g. ![name.pnghttp://...)
  text = text.replace(/!?[^\s()]*https?:\/\/[^\s)]+/g, '');

  // 4. Remove fenced code blocks ```...```
  text = text.replace(/```[\s\S]*?```/g, ' ');

  // 5. Remove inline code `...`
  text = text.replace(/`.*?`/g, ' ');

  // 6. Remove HTML tags <...>
  text = text.replace(/<[^>]*>/g, ' ');

  // 7. Remove markdown headers, blockquotes, lists
  text = text.replace(/^[ \t]*[#>-]+[ \t]+/gm, '');
  text = text.replace(/^[ \t]*\d+\.[ \t]+/gm, '');

  // 8. Remove formatting markers (*, _, ~, #)
  text = text.replace(/[*_~#]/g, '');

  // 9. Normalize whitespace and newlines
  text = text.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();
}
