/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Collects every same-origin CSS rule on the page (the bundled Tailwind build). */
function collectPageCss(): string {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        return ''; // cross-origin sheet (e.g. Google Fonts), linked separately below
      }
    })
    .join('\n');
}

/** Wraps a rendered element into a self-contained HTML page that looks the same offline. */
export function buildStandaloneHtml(element: HTMLElement, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
${collectPageCss()}
body { margin: 0; background: #0b0d11; color: #f4f4f5; font-family: 'Plus Jakarta Sans', sans-serif; }
.epk-page { max-width: 1100px; margin: 40px auto; padding: 0 16px; }
</style>
</head>
<body>
<main class="epk-page">
${element.outerHTML}
</main>
</body>
</html>
`;
}
