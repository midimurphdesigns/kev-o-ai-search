/**
 * Minimal, dependency-free markdown-to-HTML renderer for Kev-O message bubbles.
 *
 * Supports exactly the features Kev-O actually emits:
 *   - Paragraphs (double-newline split)
 *   - Inline links: [text](url) → rewritten to absolute kevinmurphywebdev.com URL
 *     when path starts with `/`, plus rel=external attributes
 *   - Inline code: `code`
 *   - Bold: **text**
 *   - Italic: *text* / _text_
 *   - Unordered lists: lines starting with `- ` or `* `
 *
 * Everything is HTML-escaped first, then markdown rewrites apply to the
 * escaped text. This makes XSS impossible by construction; even if Claude
 * emits raw HTML, it gets neutralized before any markdown pass runs.
 */

const MAIN_SITE = 'https://kevinmurphywebdev.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // Inline code first so we don't mangle markdown inside it
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, urlRaw: string) => {
    const url = urlRaw.trim();
    const isInternal = url.startsWith('/');
    const absolute = isInternal ? `${MAIN_SITE}${url}` : url;
    return `<a href="${absolute}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  // Bold then italic (bold first so ** doesn't get consumed by *)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  return out;
}

export function renderMessageHtml(markdown: string): string {
  const blocks = markdown.split(/\n{2,}/);
  const html: string[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${renderInline(l.replace(/^\s*[-*]\s+/, ''))}</li>`);
      html.push(`<ul>${items.join('')}</ul>`);
    } else {
      html.push(`<p>${renderInline(block)}</p>`);
    }
  }
  return html.join('\n');
}
