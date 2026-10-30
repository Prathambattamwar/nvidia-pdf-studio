'use strict';

// NVIDIA's Chat Completions endpoint supports constrained JSON Schema output.
// Keep the schema deliberately small and explicit so the PDF renderer receives
// predictable fields rather than trying to infer structure from free-form text.
const DOCUMENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    document_type: { type: 'string' },
    abstract: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          heading: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['heading', 'content']
      }
    },
    conclusion: { type: 'string' },
    key_takeaways: { type: 'array', items: { type: 'string' } }
  },
  required: [
    'title', 'subtitle', 'document_type', 'abstract', 'keywords',
    'sections', 'conclusion', 'key_takeaways'
  ]
};

const DOCUMENT_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'professional_pdf_document',
    strict: true,
    schema: DOCUMENT_JSON_SCHEMA
  }
};

function findBalancedJsonObject(text) {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return '';
}

function extractJson(text) {
  if (text && typeof text === 'object' && !Array.isArray(text)) return text;
  const source = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!source) throw new Error('The AI returned an empty document response.');

  const candidates = [
    source.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim(),
    findBalancedJsonObject(source)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* try the next complete JSON candidate */ }
  }

  const error = new Error('The AI response was incomplete or did not match the required document structure.');
  error.code = 'INVALID_MODEL_JSON';
  throw error;
}

function validateDocumentShape(value) {
  const problems = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    problems.push('response must be an object');
  } else {
    for (const key of ['title', 'subtitle', 'document_type', 'abstract', 'conclusion']) {
      if (typeof value[key] !== 'string') problems.push(`${key} must be text`);
    }
    if (!Array.isArray(value.keywords) || value.keywords.some(item => typeof item !== 'string')) {
      problems.push('keywords must be an array of text');
    }
    if (!Array.isArray(value.sections) || value.sections.length === 0) {
      problems.push('sections must contain at least one section');
    } else if (value.sections.some(section => !section || typeof section.heading !== 'string' || typeof section.content !== 'string')) {
      problems.push('every section must contain text heading and content');
    }
    if (!Array.isArray(value.key_takeaways) || value.key_takeaways.some(item => typeof item !== 'string')) {
      problems.push('key_takeaways must be an array of text');
    }
  }
  if (problems.length) {
    const error = new Error(`The AI response did not match the document schema: ${problems.join('; ')}.`);
    error.code = 'INVALID_DOCUMENT_SHAPE';
    throw error;
  }
  return value;
}

module.exports = {
  DOCUMENT_JSON_SCHEMA,
  DOCUMENT_RESPONSE_FORMAT,
  extractJson,
  validateDocumentShape
};
