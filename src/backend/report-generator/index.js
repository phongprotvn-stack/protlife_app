/**
 * REPORT GENERATOR
 *
 * Unified engine for generating reports in multiple formats:
 *   PDF, Excel, Word, Google Sheets, Google Docs, JSON
 *
 * Each format generator is a separate module.
 * Frontend selects format + collections + options.
 */

import { generatePdf } from './pdf.js';
import { generateExcel } from './excel.js';
import { generateWord } from './word.js';
import { generateGoogleSheets, generateGoogleDocs } from './google.js';

const FORMATS = {
  pdf:      { name: 'PDF',              generator: generatePdf,           mime: 'application/pdf',          ext: '.pdf' },
  excel:    { name: 'Excel',            generator: generateExcel,         mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx' },
  word:     { name: 'Word',             generator: generateWord,          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' },
  'google-sheets': { name: 'Google Sheets', generator: generateGoogleSheets, mime: 'application/json', ext: '' },
  'google-docs':   { name: 'Google Docs',    generator: generateGoogleDocs,    mime: 'application/json', ext: '' },
  json:     { name: 'JSON',             generator: null,                  mime: 'application/json',         ext: '.json' },
};

/**
 * Generate a report.
 *
 * @param {string} format     - 'pdf' | 'excel' | 'word' | 'google-sheets' | 'google-docs' | 'json'
 * @param {object} data       - { people[], events[], memories[], places[], tags[], stats{} }
 * @param {object} options    - { title, dateRange, includeStats, filters }
 * @param {string} userId     - Firebase UID
 * @returns {{ buffer?: Buffer, headers: object, filename: string }}
 */
export async function generateReport(format, data, options = {}, userId) {
  const fmt = FORMATS[format];
  if (!fmt) throw new Error(`Unsupported format: ${format}`);

  const now = new Date().toISOString().split('T')[0];
  const filename = options.title
    ? `${options.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${now}${fmt.ext}`
    : `protlife_report_${now}${fmt.ext}`;

  const headers = {
    'Content-Type': fmt.mime,
    'Content-Disposition': `attachment; filename="${filename}"`,
  };

  // JSON is a simple pass-through
  if (format === 'json') {
    return {
      buffer: Buffer.from(JSON.stringify(data, null, 2)),
      headers,
      filename,
    };
  }

  const generator = fmt.generator;
  if (!generator) throw new Error(`Generator not available for format: ${format}`);

  const result = await generator(data, options, userId);
  return {
    buffer: result.buffer || result,
    headers: result.headers || headers,
    filename: result.filename || filename,
  };
}

export function listFormats() {
  return Object.entries(FORMATS).map(([id, info]) => ({
    id,
    name: info.name,
    mime: info.mime,
    ext: info.ext,
    available: true,
  }));
}

export default { generateReport, listFormats };
