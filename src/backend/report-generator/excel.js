/**
 * EXCEL REPORT GENERATOR
 *
 * Produces .xlsx workbook with:
 *   - Summary sheet (stats, filters info)
 *   - People sheet
 *   - Events sheet
 *   - Memories sheet
 *   - Places sheet
 */

import XLSX from 'xlsx';

export async function generateExcel(data, options = {}) {
  const wb = XLSX.utils.book_new();
  const { title = 'ProtSphere Report', dateRange = '', includeStats = true } = options;

  // ── Summary sheet ──
  const summaryRows = [
    ['ProtSphere Report'],
    [''],
    ['Title', title],
    ['Generated', new Date().toISOString()],
    ['Date Range', dateRange || 'All time'],
  ];
  if (includeStats) {
    const stats = data.stats || {};
    summaryRows.push(['']);
    summaryRows.push(['── Statistics ──']);
    summaryRows.push(['Total People',      count(data.people)]);
    summaryRows.push(['Total Events',      count(data.events)]);
    summaryRows.push(['Total Memories',    count(data.memories)]);
    summaryRows.push(['Total Places',      count(data.places)]);
    summaryRows.push(['Total Tags',        (data.tags || []).length]);
  }
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── People sheet ──
  if (data.people?.length) {
    const wsPeople = XLSX.utils.json_to_sheet(data.people.map(normalizePerson));
    XLSX.utils.book_append_sheet(wb, wsPeople, 'People');
  }

  // ── Events sheet ──
  if (data.events?.length) {
    const wsEvents = XLSX.utils.json_to_sheet(data.events.map(normalizeEvent));
    XLSX.utils.book_append_sheet(wb, wsEvents, 'Events');
  }

  // ── Memories sheet ──
  if (data.memories?.length) {
    const wsMemories = XLSX.utils.json_to_sheet(data.memories);
    XLSX.utils.book_append_sheet(wb, wsMemories, 'Memories');
  }

  // ── Places sheet ──
  if (data.places?.length) {
    const wsPlaces = XLSX.utils.json_to_sheet(data.places);
    XLSX.utils.book_append_sheet(wb, wsPlaces, 'Places');
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return { buffer };
}

function count(arr) { return Array.isArray(arr) ? arr.length : 0; }

function normalizePerson(p) {
  return {
    Name: p.name || '',
    Relationship: p.relationship || '',
    Phone: Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || '',
    Email: Array.isArray(p.emails) ? p.emails.join(', ') : p.emails || '',
    Birthday: p.dob || '',
    Organization: p.organization || '',
    Score: p.relationshipScore ?? '',
    Tags: Array.isArray(p.tags) ? p.tags.map(t => t.name || t).join(', ') : '',
    Note: p.note || '',
    Created: p.createdAt || '',
    Updated: p.updatedAt || '',
  };
}

function normalizeEvent(e) {
  return {
    Title: e.title || '',
    Date: e.date || '',
    Description: e.description || '',
    Location: e.location || '',
    People: Array.isArray(e.participants) ? e.participants.map(p => p.name || p).join(', ') : '',
    Type: e.type || '',
    Note: e.note || '',
  };
}

export default { generateExcel };
