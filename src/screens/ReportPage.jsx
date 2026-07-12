import { useState, useMemo } from 'react';
import { t } from '../i18n';
import * as XLSX from 'xlsx';

const REPORT_TYPES = ['events', 'memories', 'relationships', 'full'];

const REPORT_META = {
  events: {
    icon: '📅', vi: 'Báo cáo Sự kiện', en: 'Events Report',
    collections: ['events'],
    showEventTables: true, showPeople: false, showMemories: false,
  },
  memories: {
    icon: '💭', vi: 'Báo cáo Ký ức', en: 'Memories Report',
    collections: ['memories'],
    showEventTables: false, showPeople: false, showMemories: true,
  },
  relationships: {
    icon: '👥', vi: 'Báo cáo Quan hệ', en: 'Relationships Report',
    collections: ['people', 'memories'],
    showEventTables: false, showPeople: true, showMemories: true,
  },
  full: {
    icon: '📊', vi: 'Báo cáo Tổng quan', en: 'Full Life Report',
    collections: ['people', 'events', 'memories', 'places'],
    showEventTables: true, showPeople: true, showMemories: true,
  },
};

// Helper: resolve person IDs to names
const resolvePeople = (peopleIds, allPeople) => {
  if (!peopleIds || peopleIds.length === 0) return '';
  return peopleIds.map(id => {
    const p = allPeople.find(p => p.id === id);
    return p ? p.name : id;
  }).join(', ');
};

// Generate EventID in Excel format: EV + YYYYMMDD + 3-digit per-date sequence
const buildEventIdMap = (sortedEvents) => {
  const map = new Map();
  const seq = {};
  sortedEvents.forEach((e) => {
    if (e.date) {
      const key = e.date.replace(/-/g, '');
      seq[key] = (seq[key] || 0) + 1;
      map.set(e.id, `EV${key}${String(seq[key]).padStart(3, '0')}`);
    } else {
      map.set(e.id, `EV${String(sortedEvents.indexOf(e) + 1).padStart(4, '0')}`);
    }
  });
  return map;
};

// Generate ContactID in Excel format: C + 4-digit zero-padded index
const buildContactIdMap = (peopleList) => {
  const map = new Map();
  peopleList.forEach((p, i) => {
    map.set(p.id, `C${String(i + 1).padStart(4, '0')}`);
  });
  return map;
};

// Org 2 mapping — matches bảng dữ liệu Excel gốc
const ORG2_BY_NAME = {
  'NHA Phúc': 'Sư đoàn Mõm',
  'NHA Tân': 'Sư đoàn Mõm',
  'SBV Thành Mega': 'Sư đoàn Mõm',
  'PCRT E. Kỳ': '3 Musketeers',
  'PCRT A. Ngọc': '3 Musketeers',
};
const getOrg2 = (person) => {
  if (person.organization2) return person.organization2;
  return ORG2_BY_NAME[person.name] || '';
};

export default function ReportPage({ people, events, memories, places, lang, onClose }) {
  const [reportType, setReportType] = useState('events');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const vi = lang === 'vi';

  const meta = REPORT_META[reportType];
  const showEventTables = meta.showEventTables;
  const showMemories = meta.showMemories;
  const showPeople = meta.showPeople;
  const showPlaces = reportType === 'full';

  // Filter by date range, sorted ascending by date
  const filteredEvents = useMemo(() => {
    if (!showEventTables) return [];
    return events.filter(e => {
      if (dateFrom && e.date && e.date < dateFrom) return false;
      if (dateTo && e.date && e.date > dateTo) return false;
      return true;
    }).sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }, [events, dateFrom, dateTo, showEventTables]);

  const filteredMemories = useMemo(() => {
    if (!showMemories) return [];
    return memories.filter(m => {
      if (dateFrom && m.date && m.date < dateFrom) return false;
      if (dateTo && m.date && m.date > dateTo) return false;
      return true;
    });
  }, [memories, dateFrom, dateTo, showMemories]);

  // Generate formatted IDs matching Excel format
  const eventIdMap = useMemo(() => buildEventIdMap(filteredEvents), [filteredEvents]);
  const contactIdMap = useMemo(() => buildContactIdMap(people), [people]);

  // ── Open report HTML in new tab for Print / PDF ──
  const openReportHtml = () => {
    const now = new Date().toLocaleDateString(vi ? 'vi-VN' : 'en-US');
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Noto Sans', Arial, sans-serif; color: #1F2937; font-size: 11pt; padding: 10px; }
  h1 { font-size: 20pt; font-weight: 800; margin-bottom: 2px; }
  .meta { color: #9CA3AF; font-size: 9pt; margin-bottom: 16pt; }
  h2 { font-size: 14pt; font-weight: 700; margin: 20pt 0 8pt; border-bottom: 2px solid #E5E7EB; padding-bottom: 4pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16pt; font-size: 9pt; }
  th { background: #F3F4F6; font-weight: 700; text-align: left; padding: 6pt 8pt; border-bottom: 2px solid #D1D5DB; }
  td { padding: 5pt 8pt; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .num { text-align: right; }
  .footer { margin-top: 24pt; text-align: center; color: #D1D5DB; font-size: 8pt; }
</style></head><body>
<h1>${vi ? meta.vi : meta.en}</h1>
<div class="meta">${now}</div>`;

    // Events
    if (showEventTables && filteredEvents.length > 0) {
      html += `<h2>Events (${filteredEvents.length})</h2>
      <table><thead><tr>
        <th>#</th><th>Event ID</th><th>Title</th><th>Date</th><th>End Date</th>
        <th>Type</th><th>Location</th><th>Notes</th><th>Mood</th>
        <th>Importance</th><th>Life Stage</th><th>Source</th>
        <th class="num">Cost</th><th>Map Link</th><th>Participants</th>
      </tr></thead><tbody>`;
      filteredEvents.forEach((e, i) => {
        const evId = eventIdMap.get(e.id) || e.id;
        html += `<tr>
          <td>${i + 1}</td><td>${evId}</td><td><b>${esc(e.title)}</b></td>
          <td>${esc(e.date)}</td><td>${esc(e.endDate)}</td><td>${esc(e.eventType)}</td>
          <td>${esc(e.locationName || e.location)}</td><td>${esc(e.notes)}</td><td>${esc(e.mood)}</td>
          <td>${esc(e.importance)}</td><td>${esc(e.lifeStage)}</td><td>${esc(e.source)}</td>
          <td class="num">${e.cost ? Number(e.cost).toLocaleString() + 'd' : ''}</td>
          <td>${esc(e.mapLink)}</td>
          <td>${esc(resolvePeople(e.peopleIds, people))}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    // Memories
    if (showMemories && filteredMemories.length > 0) {
      html += `<h2>Memories (${filteredMemories.length})</h2>
      <table><thead><tr>
        <th>#</th><th>Memory ID</th><th>Title</th><th>Date</th><th>Mood</th>
        <th>Content</th><th>Related Event</th><th>Participants</th>
      </tr></thead><tbody>`;
      filteredMemories.forEach((m, i) => {
        const linkedEv = events.find(ev => ev.id === m.eventId);
        html += `<tr>
          <td>${i + 1}</td><td>${esc(m.id)}</td><td><b>${esc(m.title)}</b></td>
          <td>${esc(m.date)}</td><td>${esc(m.mood)}</td>
          <td>${esc(m.content ? m.content.substring(0, 300) : '')}</td>
          <td>${linkedEv ? esc(linkedEv.title) : esc(m.eventTitle || m.eventId || '')}</td>
          <td>${esc(resolvePeople(m.peopleIds, people))}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    // People
    if (showPeople && people.length > 0) {
      html += `<h2>People (${people.length})</h2>
      <table><thead><tr>
        <th>#</th><th>Contact ID</th><th>Name</th><th>Gender</th><th>DOB</th>
        <th>Relationship</th><th>Organization 1</th><th>Organization 2</th>
        <th>Phone</th><th>Email</th><th>Address</th><th>Notes</th>
        <th>Status</th><th>Favorite</th><th class="num">Score</th><th>Source</th>
      </tr></thead><tbody>`;
      people.forEach((p, i) => {
        const cId = contactIdMap.get(p.id) || p.id;
        html += `<tr>
          <td>${i + 1}</td><td>${cId}</td><td><b>${esc(p.name)}</b></td>
          <td>${esc(p.gender)}</td><td>${esc(p.dob)}</td><td>${esc(p.relationship)}</td>
          <td>${esc(p.organization)}</td><td>${esc(getOrg2(p))}</td>
          <td>${esc(Array.isArray(p.phones) ? p.phones.join(', ') : p.phones)}</td>
          <td>${esc(Array.isArray(p.emails) ? p.emails.join(', ') : p.emails)}</td>
          <td>${esc(p.address)}</td><td>${esc(p.notes)}</td>
          <td>${esc(p.status)}</td><td>${p.isFavorite ? 'Yes' : 'No'}</td>
          <td class="num">${p.relationshipScore ?? ''}</td>
          <td>${esc(p.source)}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `<div class="footer">Generated by ProtLife OS v2.0.0</div></body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
    return w;
  };

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // ── Download: XLSX ──
  const downloadXlsx = async () => {
    setLoading(true);
    const wb = XLSX.utils.book_new();

    const isEv = reportType === 'events' || reportType === 'full';
    const isMem = reportType === 'memories' || reportType === 'full' || reportType === 'relationships';
    const isPe = reportType === 'relationships' || reportType === 'full';

    if (isEv) {
      const hdr = ['#', 'Event ID', 'Title', 'Date', 'End Date', 'Event Type', 'Location',
        'Notes', 'Mood', 'Importance', 'Life Stage', 'Source',
        'Cost', 'Link Google Maps', 'Participants'];
      const rows = filteredEvents.map((e, i) => [
        i + 1, eventIdMap.get(e.id) || e.id || '', e.title || '', e.date || '', e.endDate || '', e.eventType || '',
        e.locationName || e.location || '', e.notes || '',
        e.mood || '', e.importance || '', e.lifeStage || '',
        e.source || '', e.cost ? Number(e.cost) : '', e.mapLink || '',
        resolvePeople(e.peopleIds, people),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Events');
    }

    if (isMem) {
      const hdr = ['#', 'Memory ID', 'Title', 'Date', 'Mood', 'Content',
        'Event ID', 'Event Title', 'Participants'];
      const rows = filteredMemories.map((m, i) => {
        const linkedEv = events.find(ev => ev.id === m.eventId);
        return [
          i + 1, m.id || '', m.title || '', m.date || '', m.mood || '', m.content || '',
          m.eventId || '', linkedEv ? linkedEv.title : m.eventTitle || '',
          resolvePeople(m.peopleIds, people),
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Memories');
    }

    if (isPe) {
      const hdr = ['#', 'Contact ID', 'Name', 'Gender', 'Date of Birth', 'Relationship',
        'Organization 1', 'Organization 2', 'Phone', 'Email', 'Address', 'Notes',
        'Status', 'Is Favorite', 'Relationship Score', 'Source'];
      const rows = people.map((p, i) => [
        i + 1, contactIdMap.get(p.id) || p.id || '', p.name || '', p.gender || '', p.dob || '', p.relationship || '',
        p.organization || '', getOrg2(p),
        Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || '',
        Array.isArray(p.emails) ? p.emails.join(', ') : p.emails || '',
        p.address || '', p.notes || '', p.status || '',
        p.isFavorite ? 'Yes' : 'No', p.relationshipScore ?? '', p.source || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'People');
    }

    if (reportType === 'full') {
      const hdr = ['#', 'Name', 'Address'];
      const rows = places.map((p, i) => [i + 1, p.name || '', p.address || '']);
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Places');
    }

    XLSX.writeFile(wb, `${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
    setLoading(false);
  };

  // ── Download: DOCX ──
  const downloadDocx = async () => {
    setLoading(true);
    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, WidthType, AlignmentType, HeadingLevel } = await import('docx');

      const children = [];

      children.push(new Paragraph({
        children: [new TextRun({ text: vi ? meta.vi : meta.en, bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({
          text: `Generated: ${new Date().toLocaleDateString(vi ? 'vi-VN' : 'en-US')}`,
          size: 18, color: '666666',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }));

      const mkCell = (txt, bold) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: txt ?? '', bold, size: 20 })] })],
        width: { size: 1800, type: WidthType.DXA },
      });

      if (showEventTables && filteredEvents.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Events (${filteredEvents.length})`, bold: true, size: 26 })],
          spacing: { before: 400, after: 200 },
          heading: HeadingLevel.HEADING_2,
        }));
        const hdr = ['#', 'Event ID', 'Title', 'Date', 'End Date', 'Type', 'Location', 'Cost', 'Participants'];
        const rows = [new TableRow({ tableHeader: true, children: hdr.map(h => mkCell(h, true)) })];
        for (const [i, e] of filteredEvents.entries()) {
          rows.push(new TableRow({ children: [
            mkCell(String(i + 1)), mkCell(eventIdMap.get(e.id) || e.id || ''), mkCell(e.title), mkCell(e.date),
            mkCell(e.endDate), mkCell(e.eventType),
            mkCell(e.locationName || e.location),
            mkCell(e.cost ? Number(e.cost).toLocaleString() + 'd' : ''),
            mkCell(resolvePeople(e.peopleIds, people)),
          ] }));
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      if (showMemories && filteredMemories.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Memories (${filteredMemories.length})`, bold: true, size: 26 })],
          spacing: { before: 400, after: 200 },
          heading: HeadingLevel.HEADING_2,
        }));
        const hdr = ['#', 'Title', 'Date', 'Mood', 'Content', 'Participants'];
        const rows = [new TableRow({ tableHeader: true, children: hdr.map(h => mkCell(h, true)) })];
        for (const [i, m] of filteredMemories.entries()) {
          rows.push(new TableRow({ children: [
            mkCell(String(i + 1)), mkCell(m.title), mkCell(m.date),
            mkCell(m.mood), mkCell(m.content?.substring(0, 200) || ''),
            mkCell(resolvePeople(m.peopleIds, people)),
          ] }));
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      if (showPeople && people.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `People (${people.length})`, bold: true, size: 26 })],
          spacing: { before: 400, after: 200 },
          heading: HeadingLevel.HEADING_2,
        }));
        const hdr = ['#', 'Contact ID', 'Name', 'Relationship', 'Score', 'Status', 'Source'];
        const rows = [new TableRow({ tableHeader: true, children: hdr.map(h => mkCell(h, true)) })];
        for (const [i, p] of people.entries()) {
          rows.push(new TableRow({ children: [
            mkCell(String(i + 1)), mkCell(contactIdMap.get(p.id) || p.id || ''), mkCell(p.name),
            mkCell(p.relationship), mkCell(String(p.relationshipScore ?? '')),
            mkCell(p.status), mkCell(p.source),
          ] }));
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      children.push(new Paragraph({
        children: [new TextRun({ text: 'Generated by ProtLife OS v2.0.0', size: 16, color: '999999' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
      }));

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`DOC generation error: ${e.message}`);
    }
    setLoading(false);
  };

  // ── PDF: open in new tab with print dialog (no encoding issues) ──
  const downloadPdf = async () => {
    setLoading(true);
    openReportHtml();
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#F8F8FA', zIndex: 1001,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 24px', background: '#fff',
        borderBottom: '1px solid #E5E7EB', flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <button onClick={onClose} style={{
          padding: '8px 14px', borderRadius: 10,
          background: '#F3F4F6', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#374151',
        }}>
          ← {vi ? 'Quay lai' : 'Back'}
        </button>

        {/* Report type selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {REPORT_TYPES.map(t => {
            const m = REPORT_META[t];
            const active = t === reportType;
            return (
              <button key={t} onClick={() => setReportType(t)} style={{
                padding: '6px 14px', borderRadius: 20,
                border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: active ? '#E6002D' : '#F3F4F6',
                color: active ? '#fff' : '#374151',
                borderColor: active ? '#E6002D' : '#E5E7EB',
              }}>
                {t === reportType ? '✓ ' : ''}{vi ? m.vi : m.en}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>
            {vi ? 'Tu' : 'From'}:
          </span>
          <input type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>→</span>
          <input type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              style={{ padding: '4px 8px', borderRadius: 6, background: '#FEE2E2', border: 'none', cursor: 'pointer', fontSize: 11, color: '#991B1B' }}>
              ✕ {vi ? 'Xoa' : 'Clear'}
            </button>
          )}
        </div>

        {/* Download buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={downloadXlsx} disabled={loading} style={{
            padding: '8px 14px', borderRadius: 10,
            background: '#059669', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '...' : 'XLSX'}
          </button>
          <button onClick={downloadDocx} disabled={loading} style={{
            padding: '8px 14px', borderRadius: 10,
            background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '...' : 'DOC'}
          </button>
          <button onClick={downloadPdf} disabled={loading} style={{
            padding: '8px 14px', borderRadius: 10,
            background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* ── Report content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {showEventTables && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', minWidth: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#E6002D' }}>{filteredEvents.length}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{vi ? 'Su kien' : 'Events'}</div>
            </div>
          )}
          {showMemories && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', minWidth: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#7C3AED' }}>{filteredMemories.length}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{vi ? 'Ky uc' : 'Memories'}</div>
            </div>
          )}
          {showPeople && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', minWidth: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#2563EB' }}>{people.length}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{vi ? 'Nguoi' : 'People'}</div>
            </div>
          )}
          {showPlaces && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', minWidth: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{places.length}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{vi ? 'Dia diem' : 'Places'}</div>
            </div>
          )}
        </div>

        {/* Events table */}
        {showEventTables && filteredEvents.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#111827' }}>
              {vi ? 'Su kien' : 'Events'} ({filteredEvents.length})
            </h2>
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, padding: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Event ID</th>
                    <th style={thStyle}>{vi ? 'Ten' : 'Title'}</th>
                    <th style={thStyle}>{vi ? 'Ngay' : 'Date'}</th>
                    <th style={thStyle}>{vi ? 'Ngay KT' : 'End Date'}</th>
                    <th style={thStyle}>{vi ? 'Loai' : 'Type'}</th>
                    <th style={thStyle}>{vi ? 'Dia diem' : 'Location'}</th>
                    <th style={thStyle}>{vi ? 'Ghi chu' : 'Notes'}</th>
                    <th style={thStyle}>{vi ? 'Tam trang' : 'Mood'}</th>
                    <th style={thStyle}>{vi ? 'Muc do' : 'Importance'}</th>
                    <th style={thStyle}>{vi ? 'Giai doan' : 'Life Stage'}</th>
                    <th style={thStyle}>{vi ? 'Nguon' : 'Source'}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>{vi ? 'Chi phi' : 'Cost'}</th>
                    <th style={thStyle}>{vi ? 'Map Link' : 'Map Link'}</th>
                    <th style={thStyle}>{vi ? 'Nguoi tham gia' : 'Participants'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{eventIdMap.get(e.id) || e.id || ''}</td>
                      <td style={tdStyle}><strong>{e.title || ''}</strong></td>
                      <td style={tdStyle}>{e.date || ''}</td>
                      <td style={tdStyle}>{e.endDate || ''}</td>
                      <td style={tdStyle}>{e.eventType || ''}</td>
                      <td style={tdStyle}>{e.locationName || e.location || ''}</td>
                      <td style={tdStyle}>{e.notes || ''}</td>
                      <td style={tdStyle}>{e.mood || ''}</td>
                      <td style={tdStyle}>{e.importance || ''}</td>
                      <td style={tdStyle}>{e.lifeStage || ''}</td>
                      <td style={tdStyle}>{e.source || ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{e.cost ? Number(e.cost).toLocaleString() + 'd' : ''}</td>
                      <td style={tdStyle}>{e.mapLink || ''}</td>
                      <td style={tdStyle}>{resolvePeople(e.peopleIds, people)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Memories */}
        {showMemories && filteredMemories.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#111827' }}>
              {vi ? 'Ky uc' : 'Memories'} ({filteredMemories.length})
            </h2>
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, padding: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Memory ID</th>
                    <th style={thStyle}>{vi ? 'Tieu de' : 'Title'}</th>
                    <th style={thStyle}>{vi ? 'Ngay' : 'Date'}</th>
                    <th style={thStyle}>{vi ? 'Tam trang' : 'Mood'}</th>
                    <th style={thStyle}>{vi ? 'Noi dung' : 'Content'}</th>
                    <th style={thStyle}>{vi ? 'Event lien quan' : 'Related Event'}</th>
                    <th style={thStyle}>{vi ? 'Nguoi tham gia' : 'Participants'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMemories.map((m, i) => {
                    const linkedEv = events.find(ev => ev.id === m.eventId);
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{m.id || ''}</td>
                        <td style={tdStyle}><strong>{m.title || ''}</strong></td>
                        <td style={tdStyle}>{m.date || ''}</td>
                        <td style={tdStyle}>{m.mood || ''}</td>
                        <td style={tdStyle}>{m.content?.substring(0, 300) || ''}</td>
                        <td style={tdStyle}>{linkedEv ? linkedEv.title : m.eventTitle || m.eventId || ''}</td>
                        <td style={tdStyle}>{resolvePeople(m.peopleIds, people)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* People */}
        {showPeople && people.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#111827' }}>
              {vi ? 'Danh sach quan he' : 'Relationships'} ({people.length})
            </h2>
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, padding: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Contact ID</th>
                    <th style={thStyle}>{vi ? 'Ten' : 'Name'}</th>
                    <th style={thStyle}>{vi ? 'Gioi tinh' : 'Gender'}</th>
                    <th style={thStyle}>{vi ? 'Ngay sinh' : 'DOB'}</th>
                    <th style={thStyle}>{vi ? 'Quan he' : 'Relationship'}</th>
                    <th style={thStyle}>{vi ? 'To chuc 1' : 'Org 1'}</th>
                    <th style={thStyle}>{vi ? 'To chuc 2' : 'Org 2'}</th>
                    <th style={thStyle}>{vi ? 'Dien thoai' : 'Phone'}</th>
                    <th style={thStyle}>{vi ? 'Email' : 'Email'}</th>
                    <th style={thStyle}>{vi ? 'Dia chi' : 'Address'}</th>
                    <th style={thStyle}>{vi ? 'Ghi chu' : 'Notes'}</th>
                    <th style={thStyle}>{vi ? 'Trang thai' : 'Status'}</th>
                    <th style={thStyle}>{vi ? 'Yeu thich' : 'Fav'}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>{vi ? 'Diem' : 'Score'}</th>
                    <th style={thStyle}>{vi ? 'Nguon' : 'Source'}</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{contactIdMap.get(p.id) || p.id || ''}</td>
                      <td style={tdStyle}><strong>{p.name || ''}</strong></td>
                      <td style={tdStyle}>{p.gender || ''}</td>
                      <td style={tdStyle}>{p.dob || ''}</td>
                      <td style={tdStyle}>{p.relationship || ''}</td>
                      <td style={tdStyle}>{p.organization || ''}</td>
                      <td style={tdStyle}>{getOrg2(p)}</td>
                      <td style={tdStyle}>{Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || ''}</td>
                      <td style={tdStyle}>{Array.isArray(p.emails) ? p.emails.join(', ') : p.emails || ''}</td>
                      <td style={tdStyle}>{p.address || ''}</td>
                      <td style={tdStyle}>{p.notes || ''}</td>
                      <td style={tdStyle}>{p.status || ''}</td>
                      <td style={tdStyle}>{p.isFavorite ? 'Yes' : 'No'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{p.relationshipScore ?? ''}</td>
                      <td style={tdStyle}>{p.source || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredEvents.length === 0 && filteredMemories.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{vi ? 'Khong co du lieu' : 'No data found'}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{vi ? 'Thu dieu chinh khoang thoi gian' : 'Try adjusting the date range'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#374151',
  textAlign: 'left', borderBottom: '2px solid #E5E7EB', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '7px 10px', fontSize: 12, color: '#1F2937',
  verticalAlign: 'top', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
};
