'use strict';

// Match branding even when copied/generated text contains non-breaking spaces,
// zero-width characters, Unicode dashes, punctuation, or line breaks.
const GAP = String.raw`[\s\p{Cf}\p{P}\p{Z}]+`;
const BRAND_PATTERNS = [
  new RegExp(String.raw`(?<![\p{L}\p{N}])(?:powered${GAP}by${GAP})?nvidia${GAP}pdf${GAP}studio(?![\p{L}\p{N}])`, 'giu'),
  new RegExp(String.raw`(?<![\p{L}\p{N}])created${GAP}with${GAP}nvidia${GAP}hosted${GAP}ai${GAP}(?:and|&)${GAP}pdfkit(?![\p{L}\p{N}])`, 'giu'),
  new RegExp(String.raw`(?<![\p{L}\p{N}])created${GAP}with${GAP}pdfkit(?![\p{L}\p{N}])`, 'giu'),
  new RegExp(String.raw`(?<![\p{L}\p{N}])pdf${GAP}studio(?![\p{L}\p{N}])`, 'giu')
];

function removePdfBranding(value) {
  let output = String(value ?? '').normalize('NFKC');
  // Strip invisible formatting characters that can split words in generated text.
  output = output.replace(/[\u200B-\u200F\u2060\uFEFF]/g, '');
  for (const pattern of BRAND_PATTERNS) output = output.replace(pattern, ' ');
  return output
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/([([{])[ \t]+/g, '$1')
    .replace(/[ \t]+([)\]}])/g, '$1')
    .replace(/[ \t]*[•·|–—-][ \t]*(?=$|\n)/g, '')
    .trim();
}

function removePdfBrandingFromObject(value, key = '') {
  if (typeof value === 'string') {
    // Keep source URLs intact; only visible title/snippet/domain text is sanitized.
    if (/^(url|uri|href)$/i.test(key) && /^https?:\/\//i.test(value)) return value;
    return removePdfBranding(value);
  }
  if (Array.isArray(value)) return value.map(item => removePdfBrandingFromObject(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [
      childKey,
      removePdfBrandingFromObject(item, childKey)
    ]));
  }
  return value;
}

function sanitizePdfTextArgument(value) {
  if (typeof value === 'string') return removePdfBranding(value);
  if (Array.isArray(value)) return value.map(sanitizePdfTextArgument);
  if (value && typeof value === 'object') {
    const copy = { ...value };
    if (typeof copy.text === 'string') copy.text = removePdfBranding(copy.text);
    return copy;
  }
  return value;
}

// Enforce the rule at the final PDFKit drawing boundary as well as when
// normalizing AI data. Any future template or overlooked text field is covered.
function enforcePdfWhiteLabel(doc) {
  const originalText = doc.text;
  doc.text = function whiteLabelText(text, ...args) {
    return originalText.call(this, sanitizePdfTextArgument(text), ...args);
  };
  return doc;
}

function clearBrandedMetadata(info) {
  if (!info || typeof info !== 'object') return info;
  for (const [key, value] of Object.entries(info)) {
    if (typeof value === 'string') info[key] = removePdfBranding(value);
  }
  // PDFKit defaults Producer/Creator to its own name; do not print generator
  // or library attribution in user-facing PDF metadata.
  info.Author = '';
  info.Creator = '';
  info.Producer = '';
  return info;
}

module.exports = {
  removePdfBranding,
  removePdfBrandingFromObject,
  sanitizePdfTextArgument,
  enforcePdfWhiteLabel,
  clearBrandedMetadata
};
