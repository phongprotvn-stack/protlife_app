/**
 * PDF REPORT GENERATOR
 *
 * Produces PDF document with:
 *   - Title page
 *   - Statistics section
 *   - People table
 *   - Events table
 *   - Memories section
 *   - Places section
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generatePdf(data, options = {}) {
  const { title = 'ProtSphere Report' } = options;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([612, 792]); // US Letter
  let y = 740;
  const margin = 50;
  const pageWidth = 612;

  // ── Title ──
  drawText(page, title, fontBold, 22, margin, y); y -= 30;
  drawText(page, `Generated: ${new Date().toISOString()}`, font, 10, margin, y, rgb(0.4, 0.4, 0.4)); y -= 20;

  // ── Statistics ──
  y -= 10;
  drawText(page, 'Statistics', fontBold, 16, margin, y); y -= 22;
  const statsRows = [
    ['Total People',   String(count(data.people))],
    ['Total Events',   String(count(data.events))],
    ['Total Memories', String(count(data.memories))],
    ['Total Places',   String(count(data.places))],
    ['Total Tags',     String((data.tags || []).length)],
  ];
  for (const [l, v] of statsRows) {
    drawText(page, `${l}: ${v}`, font, 11, margin + 10, y); y -= 16;
  }

  // ── People ──
  if (data.people?.length) {
    y = checkPage(doc, page, y, 250);
    drawText(page, `People (${data.people.length})`, fontBold, 16, margin, y); y -= 22;
    y = drawTable(doc, page, ['Name', 'Relationship', 'Phone', 'Score'], data.people.map(p => [
      p.name || '', p.relationship || '',
      Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || '',
      String(p.relationshipScore ?? ''),
    ]), font, fontBold, margin, y);
  }

  // ── Events ──
  if (data.events?.length) {
    y = checkPage(doc, page, y, 200);
    drawText(page, `Events (${data.events.length})`, fontBold, 16, margin, y); y -= 22;
    y = drawTable(doc, page, ['Title', 'Date', 'End Date', 'Location', 'Type', 'Mood', 'Cost', 'Notes'],
      data.events.map(e => [
        e.title || '',
        e.date || '',
        e.endDate || '',
        e.locationName || e.location || '',
        e.eventType || '',
        e.mood || '',
        e.cost ? `${e.cost.toLocaleString()}đ` : '',
        e.notes ? e.notes.substring(0, 50) : '',
      ]), font, fontBold, margin, y, [140, 80, 80, 120, 70, 60, 60, 0]);
  }

  // ── Memories ──
  if (data.memories?.length) {
    y = checkPage(doc, page, y, data.memories.length * 24 + 40);
    drawText(page, `Memories (${data.memories.length})`, fontBold, 16, margin, y); y -= 22;
    for (const m of data.memories.slice(0, 40)) {
      drawText(page, `• ${m.title || 'Untitled'}`, font, 11, margin + 10, y); y -= 14;
      if (m.date) { drawText(page, `  📅 ${m.date}`, font, 9, margin + 10, y, rgb(0.4, 0.4, 0.4)); y -= 13; }
      if (m.mood) { drawText(page, `  🎭 ${m.mood}`, font, 9, margin + 10, y, rgb(0.4, 0.4, 0.4)); y -= 13; }
      if (m.eventId) {
        const linkedEvent = data.events?.find(ev => ev.id === m.eventId);
        if (linkedEvent) { drawText(page, `  📌 ${linkedEvent.title}`, font, 9, margin + 10, y, rgb(0.29, 0.24, 0.9)); y -= 13; }
      }
      if (m.content) {
        drawText(page, `  ${m.content.substring(0, 150)}`, font, 9, margin + 10, y, rgb(0.4, 0.4, 0.4));
        y -= 14;
      }
    }
    if (data.memories.length > 40) {
      drawText(page, `... and ${data.memories.length - 40} more`, font, 10, margin + 10, y, rgb(0.6, 0.6, 0.6));
      y -= 16;
    }
  }

  // ── People (Relationships) ──
  if (data.people?.length) {
    y = checkPage(doc, page, y, 250);
    drawText(page, `People — Relationships (${data.people.length})`, fontBold, 16, margin, y); y -= 22;
    y = drawTable(doc, page, ['Name', 'Relationship', 'Phone', 'Score', 'Status', 'Source'],
      data.people.map(p => [
        p.name || '',
        p.relationship || '',
        Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || '',
        String(p.relationshipScore ?? ''),
        p.status || '',
        p.source || '',
      ]), font, fontBold, margin, y, [120, 90, 100, 40, 60, 60]);
  }

  // ── Places ──
  if (data.places?.length) {
    y = checkPage(doc, page, y, data.places.length * 16 + 40);
    drawText(page, `Places (${data.places.length})`, fontBold, 16, margin, y); y -= 22;
    for (const p of data.places.slice(0, 30)) {
      drawText(page, `• ${p.name || 'Unnamed'}${p.address ? ` — ${p.address}` : ''}`, font, 11, margin + 10, y);
      y -= 14;
    }
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer };
}

function count(arr) { return Array.isArray(arr) ? arr.length : 0; }

function drawText(page, text, font, size, x, y, color = rgb(0, 0, 0)) {
  if (y < 30) return;
  page.drawText(text, { x, y, size, font, color });
}

function checkPage(doc, page, y, needed) {
  if (y - needed < 40) {
    page = doc.addPage([612, 792]);
    return 740;
  }
  return y;
}

function drawTable(doc, page, headers, rows, font, fontBold, startX, startY, colWidths) {
  if (!colWidths) colWidths = [140, 100, 120, 60];
  // If column widths don't match headers, compute evenly
  if (colWidths.length !== headers.length) {
    const avail = 520 - startX;
    colWidths = headers.map((_, i) => i === headers.length - 1 ? 0 : Math.floor(avail / (headers.length - 1)));
  }
  // Last column width = 0 means "auto fill remaining"
  if (colWidths[colWidths.length - 1] === 0) {
    const used = colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
    colWidths[colWidths.length - 1] = Math.max(80, 520 - startX - used);
  }
  const rowHeight = 18;
  let y = startY;

  // Header row
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
      y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2),
    });
  }
  y -= rowHeight;

  // Data rows
  for (const row of rows.slice(0, 50)) {
    if (y < 30) { y = 740; page = doc.addPage([612, 792]); }
    for (let i = 0; i < Math.min(row.length, headers.length); i++) {
      page.drawText(String(row[i]).substring(0, 25), {
        x: startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
        y, size: 9, font, color: rgb(0.3, 0.3, 0.3),
      });
    }
    y -= rowHeight;
  }

  return y;
}

export default { generatePdf };
