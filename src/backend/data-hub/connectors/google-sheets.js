import { registerConnector } from '../index.js';

/**
 * Google Sheets Connector
 * Fetches data from published Google Sheets CSV/TSV URL
 */
registerConnector('google-sheets', {
  name: 'Google Sheets',
  description: 'Import từ Google Sheet qua CSV URL',
  formats: ['csv', 'tsv'],

  async fetch(source) {
    const url = source.url || source;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Sheet fetch failed: ${resp.status}`);
    const text = await resp.text();
    return parseCSV(text);
  },

  transform(rows) {
    return rows.map(row => {
      const person = {
        name: row.Name || row.name || row.Tên || row.HọTên || '',
        relationship: row.Relationship || row.relationship || row.MốiQuanHệ || row.QuanHệ || '',
        phones: row.Phones || row.phones || row.Phone || row.ĐiệnThoại || row.SĐT || '',
        emails: row.Emails || row.emails || row.Email || '',
        dob: row.Birthday || row.dob || row.DOB || row.NgàySinh || row.DOBirth || '',
        organization: row.Organization || row.organization || row.TổChức || row.Nhóm || '',
        relationshipScore: parseInt(row['Relationship Score'] || row.relationshipScore || row.Score || row.Điểm || 50),
        note: row.Note || row.note || row.GhiChú || '',
        tags: row.Tags || row.tags || [],
      };
      // Parse tags if string
      if (typeof person.tags === 'string') {
        person.tags = person.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => ({ id: t.toLowerCase(), name: t }));
      }
      return person;
    });
  },

  async export(data, target) {
    // Google Sheets export not implemented yet
    throw new Error('Google Sheets export coming soon');
  },
});

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0].trim());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
