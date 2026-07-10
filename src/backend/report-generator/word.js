/**
 * WORD REPORT GENERATOR
 *
 * Produces .docx document with:
 *   - Title page
 *   - Statistics section
 *   - People table
 *   - Events table
 *   - Memories section
 *   - Places section
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle,
  PageBreak,
} from 'docx';

export async function generateWord(data, options = {}) {
  const { title = 'ProtSphere Report', dateRange = '', includeStats = true } = options;
  const now = new Date().toISOString();

  const children = [];

  // ── Title ──
  children.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 52 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${now}`, size: 20, color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: dateRange ? 100 : 400 },
    })
  );

  if (dateRange) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Date Range: ${dateRange}`, size: 20, color: '666666' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  // ── Statistics ──
  if (includeStats) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Statistics', bold: true, size: 32 })], spacing: { before: 400, after: 200 } }),
      ...buildStatRows(data)
    );
  }

  // ── People ──
  if (data.people?.length) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `People (${data.people.length})`, bold: true, size: 32 })], spacing: { before: 400, after: 200 } }),
      buildPersonTable(data.people),
    );
  }

  // ── Events ──
  if (data.events?.length) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `Events (${data.events.length})`, bold: true, size: 32 })], spacing: { before: 400, after: 200 } }),
      buildEventTable(data.events),
    );
  }

  // ── Memories ──
  if (data.memories?.length) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `Memories (${data.memories.length})`, bold: true, size: 32 })], spacing: { before: 400, after: 200 } }),
      ...data.memories.map(m => new Paragraph({
        children: [
          new TextRun({ text: m.title || 'Untitled', bold: true, size: 22 }),
          new TextRun({ text: ` — ${(m.content || '').substring(0, 200)}`, size: 20 }),
        ],
        spacing: { after: 100 },
      })),
    );
  }

  // ── Places ──
  if (data.places?.length) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `Places (${data.places.length})`, bold: true, size: 32 })], spacing: { before: 400, after: 200 } }),
      ...data.places.map(p => new Paragraph({
        children: [
          new TextRun({ text: p.name || 'Unnamed', bold: true, size: 22 }),
          new TextRun({ text: p.address ? ` — ${p.address}` : '', size: 20 }),
        ],
        spacing: { after: 100 },
      })),
    );
  }

  const doc = new Document({
    title,
    description: 'ProtSphere Report',
    creator: 'ProtSphere',
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer };
}

function buildStatRows(data) {
  const stats = data.stats || {};
  const rows = [
    ['Total People',   String(count(data.people))],
    ['Total Events',   String(count(data.events))],
    ['Total Memories', String(count(data.memories))],
    ['Total Places',   String(count(data.places))],
    ['Total Tags',     String((data.tags || []).length)],
  ];
  return rows.map(([label, val]) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, size: 22, bold: true }),
        new TextRun({ text: val, size: 22 }),
      ],
      spacing: { after: 60 },
    })
  );
}

function count(arr) { return Array.isArray(arr) ? arr.length : 0; }

function buildPersonTable(people) {
  const header = ['Name', 'Relationship', 'Phone', 'Email', 'Score', 'Tags'];
  const rows = people.map(p => [
    p.name || '',
    p.relationship || '',
    Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || '',
    Array.isArray(p.emails) ? p.emails.join(', ') : p.emails || '',
    String(p.relationshipScore ?? ''),
    Array.isArray(p.tags) ? p.tags.map(t => t.name || t).join(', ') : '',
  ]);
  return buildTable([header, ...rows]);
}

function buildEventTable(events) {
  const header = ['Title', 'Date', 'Location', 'Type'];
  const rows = events.map(e => [
    e.title || '',
    e.date || '',
    e.location || '',
    e.type || '',
  ]);
  return buildTable([header, ...rows]);
}

function buildTable(data) {
  const rows = data.map((row, ri) =>
    new TableRow({
      children: row.map(cellText =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: String(cellText), size: 18, bold: ri === 0 })],
          })],
          width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
          shading: ri === 0 ? { fill: 'E5E7EB' } : undefined,
        })
      ),
    })
  );
  return new Table({ rows });
}

export default { generateWord };
