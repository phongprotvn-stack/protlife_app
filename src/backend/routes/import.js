import { Router } from 'express';
import { getDb } from '../firebase-admin.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { runImport, listConnectors } from '../data-hub/index.js';
import '../data-hub/connectors/google-sheets.js';
import '../data-hub/connectors/json.js';
import mammoth from 'mammoth';
import XLSX from 'xlsx';

const router = Router();
const db = getDb();

// List available connectors
router.get('/connectors', (req, res) => {
  res.json({ connectors: listConnectors() });
});

// Import from Google Sheets (URL)
router.post('/sheets', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing sheet URL' });
    const result = await runImport('google-sheets', { url }, req.user.uid, db);
    res.json({ message: `Import: ${result.created} created, ${result.updated} updated, ${result.failed} failed`, ...result });
  } catch (err) { next(err); }
});

// Import from JSON body
router.post('/json', requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const data = req.body.data || req.body;
    const result = await runImport('json', { data }, req.user.uid, db);
    res.json({ message: `Import: ${result.created} created, ${result.updated} updated`, ...result });
  } catch (err) { next(err); }
});

// Upload file → import (JSON, CSV, Excel)
router.post('/upload', requireRole(ROLES.VIEWER), async (req, res, next) => {
  // Basic file upload handling via raw body or multipart
  // For now, accepts JSON body array
  try {
    const { items, format } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Missing items array' });
    const result = await runImport('json', { data: items }, req.user.uid, db);
    res.json({ message: `Import: ${result.created} created, ${result.updated} updated`, ...result });
  } catch (err) { next(err); }
});

// Parse uploaded Excel/Word file (base64) → return structured JSON
router.post('/parse-file', requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const { fileBase64, fileName, mimeType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'Missing fileBase64' });

    const ext = (fileName || '').toLowerCase().split('.').pop();
    const buffer = Buffer.from(fileBase64, 'base64');
    let rows = [];

    if (ext === 'xlsx' || ext === 'xls' || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
      // ── Parse Excel ──
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      rows = json.map(r => {
        const keys = Object.keys(r).reduce((acc, k) => {
          const clean = k.trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (clean.includes('name') || clean.includes('fullname') || clean.includes('tên')) acc.name = r[k];
          else if (clean.includes('email') || clean.includes('mail')) acc.email = r[k];
          else if (clean.includes('phone') || clean.includes('phone') || clean.includes('số') || clean.includes('đt')) acc.phone = r[k];
          else if (clean.includes('note') || clean.includes('notes') || clean.includes('ghi')) acc.notes = r[k];
          else if (clean.includes('tags') || clean.includes('tag') || clean.includes('thẻ')) acc.tags = r[k];
          else if (clean.includes('address') || clean.includes('địa')) acc.address = r[k];
          else if (clean.includes('birth') || clean.includes('birthday') || clean.includes('sinh')) acc.birthday = r[k];
          else if (clean.includes('type') || clean.includes('category') || clean.includes('loại')) acc.type = r[k];
          return acc;
        }, {});
        return Object.keys(keys).length > 0 ? keys : r;
      });
    } else if (ext === 'docx' || mimeType?.includes('word')) {
      // ── Parse Word ──
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;
      // Split into paragraphs, try to detect structured data
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const headerPattern = /^[№#]?\.?\s*(.+?)[:\t]{1,}(.+)$/;
      let current = {};
      const entries = [];
      for (const line of lines) {
        const m = line.match(headerPattern);
        if (m) {
          current[m[1].trim()] = m[2].trim();
        } else if (current.name || current.Name) {
          entries.push({ ...current });
          current = {};
        }
      }
      if (Object.keys(current).length) entries.push(current);
      rows = entries.length > 0 ? entries : lines.map(l => ({ content: l }));
    } else {
      return res.status(400).json({ error: `Unsupported format: .${ext}. Supported: .xlsx, .xls, .docx` });
    }

    res.json({
      fileName,
      rows,
      total: rows.length,
      collections: inferCollections(rows),
    });
  } catch (err) { next(err); }
});

// Helper to guess which collections the data maps to
function inferCollections(rows) {
  if (!rows || rows.length === 0) return [];
  const sample = JSON.stringify(rows.slice(0, 3)).toLowerCase();
  const cols = new Set();
  if (/\b(name|fullname|email|phone|birthday|address)\b/.test(sample)) cols.add('people');
  if (/\b(title|event|date|location|start|end)\b/.test(sample)) cols.add('events');
  if (/\b(memory|story|note|content|reflection)\b/.test(sample)) cols.add('memories');
  if (/\b(place|address|city|location|country|lat|lng)\b/.test(sample)) cols.add('places');
  return Array.from(cols);
}

export default router;
