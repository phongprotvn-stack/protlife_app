import { useState, useMemo } from 'react';
import { t } from '../i18n';
import * as XLSX from 'xlsx';

const REPORT_TYPES = ['events', 'memories', 'relationships', 'full'];

const REPORT_META = {
  events: {
    icon: '📅', vi: 'Báo cáo Sự kiện', en: 'Events Report',
    collections: ['events'],
  },
  memories: {
    icon: '💭', vi: 'Báo cáo Ký ức', en: 'Memories Report',
    collections: ['memories'],
  },
  relationships: {
    icon: '👥', vi: 'Báo cáo Quan hệ', en: 'Relationships Report',
    collections: ['people', 'events', 'memories'],
  },
  full: {
    icon: '📊', vi: 'Báo cáo Tổng quan', en: 'Full Life Report',
    collections: ['people', 'events', 'memories', 'places'],
  },
};

export default function ReportPage({ people, events, memories, places, lang, onClose }) {
  const [reportType, setReportType] = useState('events');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const vi = lang === 'vi';

  const meta = REPORT_META[reportType];
  const showEvents = meta.collections.includes('events');
  const showMemories = meta.collections.includes('memories');
  const showPeople = meta.collections.includes('people');
  const showPlaces = meta.collections.includes('places');

  // Filter by date range
  const filteredEvents = useMemo(() => {
    if (!showEvents) return [];
    return events.filter(e => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [events, dateFrom, dateTo, showEvents]);

  const filteredMemories = useMemo(() => {
    if (!showMemories) return [];
    return memories.filter(m => {
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      return true;
    });
  }, [memories, dateFrom, dateTo, showMemories]);

  // ── Download: XLSX ──
  const downloadXlsx = async () => {
    setLoading(true);
    const wb = XLSX.utils.book_new();

    if (reportType === 'events' || reportType === 'relationships' || reportType === 'full') {
      const hdr = [
        'Title', 'Date', 'End Date', 'Event Type', 'Location',
        'Description', 'Notes', 'Mood', 'Importance', 'Life Stage',
        'Source', 'Cost', 'Link Google Maps', 'Participants'
      ];
      const rows = filteredEvents.map(e => [
        e.title || '', e.date || '', e.endDate || '', e.eventType || '',
        e.locationName || e.location || '', e.description || '', e.notes || '',
        e.mood || '', e.importance || '', e.lifeStage || '',
        e.source || '', e.cost ? Number(e.cost) : '', e.mapLink || '',
        (e.peopleIds || []).join(', '),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, vi ? 'Su kien' : 'Events');
    }

    if (reportType === 'memories' || reportType === 'relationships' || reportType === 'full') {
      const hdr = [
        'Title', 'Date', 'Mood', 'Content',
        'Event ID', 'Event Title', 'Participants'
      ];
      const rows = filteredMemories.map(m => [
        m.title || '', m.date || '', m.mood || '', m.content || '',
        m.eventId || '', m.eventTitle || '',
        (m.peopleIds || []).join(', '),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, vi ? 'Ky uc' : 'Memories');
    }

    if (reportType === 'relationships' || reportType === 'full') {
      const hdr = [
        'Name', 'Gender', 'Date of Birth', 'Relationship', 'Organization',
        'Phone', 'Email', 'Address', 'Notes', 'Status',
        'Is Favorite', 'Relationship Score', 'Source',
      ];
      const rows = people.map(p => [
        p.name || '', p.gender || '', p.dob || '', p.relationship || '', p.organization || '',
        Array.isArray(p.phones) ? p.phones.join(', ') : p.phones || '',
        Array.isArray(p.emails) ? p.emails.join(', ') : p.emails || '',
        p.address || '', p.notes || '', p.status || '',
        p.isFavorite ? 'Yes' : 'No', p.relationshipScore ?? '', p.source || '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, vi ? 'Quan he' : 'People');
    }

    if (reportType === 'full') {
      const hdr = ['Name', 'Address'];
      const rows = places.map(p => [p.name || '', p.address || '']);
      const ws = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, vi ? 'Dia diem' : 'Places');
    }

    XLSX.writeFile(wb, `${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
    setLoading(false);
  };

  // ── Download: DOCX ──
  const downloadDocx = async () => {
    setLoading(true);
    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle } = await import('docx');

      const children = [];

      // Title
      children.push(new Paragraph({
        children: [new TextRun({ text: vi ? meta.vi : meta.en, bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({
          text: `${vi ? 'Ngay xuat' : 'Generated'}: ${new Date().toLocaleDateString(vi ? 'vi-VN' : 'en-US')}`,
          size: 18, color: '666666',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }));

      const makeRow = (cells, bold) => new TableRow({
        tableHeader: bold,
        children: cells.map(c => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: c, bold, size: 20 })],
          })],
          width: { size: c.length < 10 ? 1200 : 2500, type: WidthType.DXA },
        })),
      });

      // Events table
      if (showEvents && filteredEvents.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Events (${filteredEvents.length})`, bold: true, size: 26 })],
          spacing: { before: 400, after: 200 },
          heading: HeadingLevel.HEADING_2,
        }));
        const hdr = ['Title', 'Date', 'End Date', 'Type', 'Location', 'Cost'];
        const rows = [makeRow(hdr, true)];
        for (const e of filteredEvents) {
          rows.push(makeRow([
            e.title || '', e.date || '', e.endDate || '', e.eventType || '',
            e.locationName || e.location || '', e.cost ? String(Number(e.cost).toLocaleString() + 'd') : '',
          ]));
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      // Memories
      if (showMemories && filteredMemories.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Memories (${filteredMemories.length})`, bold: true, size: 26 })],
          spacing: { before: 400, after: 200 },
          heading: HeadingLevel.HEADING_2,
        }));
        const hdr = ['Title', 'Date', 'Mood', 'Content'];
        const rows = [makeRow(hdr, true)];
        for (const m of filteredMemories) {
          rows.push(makeRow([
            m.title || '', m.date || '', m.mood || '', m.content?.substring(0, 200) || '',
          ]));
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      // People
      if (showPeople && people.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `People (${people.length})`, bold: true, size: 26 })],
          spacing: { before: 400, after: 200 },
          heading: HeadingLevel.HEADING_2,
        }));
        const hdr = ['Name', 'Relationship', 'Score', 'Status', 'Source'];
        const rows = [makeRow(hdr, true)];
        for (const p of people) {
          rows.push(makeRow([
            p.name || '', p.relationship || '', String(p.relationshipScore ?? ''),
            p.status || '', p.source || '',
          ]));
        }
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      }

      // Footer
      children.push(new Paragraph({
        children: [new TextRun({ text: `${vi ? 'Duoc tao boi' : 'Generated by'} ProtLife OS v2.0.0`, size: 16, color: '999999' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
      }));

      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });

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

  // ── Download: PDF ──
  const downloadPdf = async () => {
    setLoading(true);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const fontB = await doc.embedFont(StandardFonts.HelveticaBold);

      let page = doc.addPage([612, 792]);
      let y = 750;
      const margin = 50;
      const tableX = margin + 10;

      const drawText = (text, size, x, yPos, opts = {}) => {
        if (yPos < 30) { page = doc.addPage([612, 792]); yPos = 750; }
        page.drawText(text, { x, y: yPos, size, font: opts.bold ? fontB : font, color: opts.color || rgb(0, 0, 0) });
        return yPos;
      };

      const drawTable = (headers, rows) => {
        const colW = [140, 80, 80, 90, 120, 60];
        const rh = 16;
        if (y - 20 < 30) { page = doc.addPage([612, 792]); y = 750; }
        y -= 4;
        for (let i = 0; i < headers.length; i++) {
          page.drawText(headers[i], { x: tableX + colW.slice(0, i).reduce((a, b) => a + b, 0), y, size: 8, font: fontB });
        }
        y -= rh;
        for (const row of rows.slice(0, 500)) {
          if (y < 20) { page = doc.addPage([612, 792]); y = 750; }
          for (let i = 0; i < Math.min(row.length, headers.length); i++) {
            const txt = String(row[i] ?? '').substring(0, 30);
            page.drawText(txt, { x: tableX + colW.slice(0, i).reduce((a, b) => a + b, 0), y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
          }
          y -= rh;
        }
        return y;
      };

      // Title
      y = drawText(vi ? meta.vi : meta.en, 18, margin, y, { bold: true });
      y -= 20;
      y = drawText(`${vi ? 'Ngay xuat' : 'Generated'}: ${new Date().toLocaleDateString(vi ? 'vi-VN' : 'en-US')}`, 9, margin, y, { color: rgb(0.4, 0.4, 0.4) });
      y -= 28;

      // Stats
      let stats = `Total: ${filteredEvents.length} events, ${filteredMemories.length} memories, ${people.length} people`;
      y = drawText(stats, 9, margin, y, { color: rgb(0.3, 0.3, 0.3) });
      y -= 20;

      // Events
      if (showEvents && filteredEvents.length > 0) {
        if (y < 60) { page = doc.addPage([612, 792]); y = 750; }
        y = drawText(`Events (${filteredEvents.length})`, 14, margin, y, { bold: true });
        y -= 18;
        y = drawTable(['Title', 'Date', 'End Date', 'Type', 'Location', 'Cost'],
          filteredEvents.map(e => [e.title, e.date, e.endDate, e.eventType, e.locationName || e.location, e.cost ? Number(e.cost).toLocaleString() + 'd' : '']));
        y -= 12;
      }

      // Memories
      if (showMemories && filteredMemories.length > 0) {
        if (y < 60) { page = doc.addPage([612, 792]); y = 750; }
        y = drawText(`Memories (${filteredMemories.length})`, 14, margin, y, { bold: true });
        y -= 18;
        for (const m of filteredMemories.slice(0, 100)) {
          if (y < 20) { page = doc.addPage([612, 792]); y = 750; }
          y = drawText(m.title || 'Untitled', 10, margin + 10, y, { bold: true });
          y -= 14;
          if (m.date) { y = drawText(m.date, 8, margin + 10, y, { color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
          if (m.content) { y = drawText(m.content.substring(0, 200), 8, margin + 10, y, { color: rgb(0.4, 0.4, 0.4) }); y -= 12; }
        }
        y -= 8;
      }

      // People
      if (showPeople && people.length > 0) {
        if (y < 60) { page = doc.addPage([612, 792]); y = 750; }
        y = drawText(`People (${people.length})`, 14, margin, y, { bold: true });
        y -= 18;
        y = drawTable(['Name', 'Relationship', 'Score', 'Status', 'Source', 'Phone'],
          people.map(p => [p.name, p.relationship, String(p.relationshipScore ?? ''), p.status, p.source,
            Array.isArray(p.phones) ? p.phones.join(', ') : p.phones]));
        y -= 12;
      }

      const buffer = Buffer.from(await doc.save());
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`PDF generation error: ${e.message}`);
    }
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
        borderBottom: '1px solid #E5E7EB',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          padding: '8px 14px', borderRadius: 10,
          background: '#F3F4F6', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#374151',
        }}>
          ← {vi ? 'Quay lai' : 'Back'}
        </button>

        <div style={{ flex: 1 }} />

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

        <div style={{ flex: 1 }} />

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>
            {vi ? 'Tu' : 'From'}:
          </span>
          <input type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid #D1D5DB',
              fontSize: 12, outline: 'none',
            }} />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>→</span>
          <input type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid #D1D5DB',
              fontSize: 12, outline: 'none',
            }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              style={{ padding: '4px 8px', borderRadius: 6, background: '#FEE2E2', border: 'none', cursor: 'pointer', fontSize: 11, color: '#991B1B' }}>
              ✕ {vi ? 'Xoa' : 'Clear'}
            </button>
          )}
        </div>

        {/* Download buttons */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
          <button onClick={downloadXlsx} disabled={loading} style={{
            padding: '8px 14px', borderRadius: 10,
            background: '#059669', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '...' : '📊 XLSX'}
          </button>
          <button onClick={downloadDocx} disabled={loading} style={{
            padding: '8px 14px', borderRadius: 10,
            background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '...' : '📝 DOC'}
          </button>
          <button onClick={downloadPdf} disabled={loading} style={{
            padding: '8px 14px', borderRadius: 10,
            background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '...' : '📄 PDF'}
          </button>
        </div>
      </div>

      {/* ── Report content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {showEvents && (
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
        {showEvents && filteredEvents.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#111827' }}>
              {vi ? 'Su kien' : 'Events'} ({filteredEvents.length})
            </h2>
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, padding: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={thStyle}>{vi ? 'Ten' : 'Title'}</th>
                    <th style={thStyle}>{vi ? 'Ngay' : 'Date'}</th>
                    <th style={thStyle}>{vi ? 'Ngay KT' : 'End Date'}</th>
                    <th style={thStyle}>{vi ? 'Loai' : 'Type'}</th>
                    <th style={thStyle}>{vi ? 'Dia diem' : 'Location'}</th>
                    <th style={thStyle}>{vi ? 'Mo ta' : 'Description'}</th>
                    <th style={thStyle}>{vi ? 'Ghi chu' : 'Notes'}</th>
                    <th style={thStyle}>{vi ? 'Tam trang' : 'Mood'}</th>
                    <th style={thStyle}>{vi ? 'Muc do' : 'Importance'}</th>
                    <th style={thStyle}>{vi ? 'Giai doan' : 'Life Stage'}</th>
                    <th style={thStyle}>{vi ? 'Nguon' : 'Source'}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>{vi ? 'Chi phi' : 'Cost'}</th>
                    <th style={thStyle}>{vi ? 'Dia diem Map' : 'Map Link'}</th>
                    <th style={thStyle}>{vi ? 'Nguoi tham gia' : 'Participants'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={tdStyle}><strong>{e.title || ''}</strong></td>
                      <td style={tdStyle}>{e.date || ''}</td>
                      <td style={tdStyle}>{e.endDate || ''}</td>
                      <td style={tdStyle}>{e.eventType || ''}</td>
                      <td style={tdStyle}>{e.locationName || e.location || ''}</td>
                      <td style={tdStyle}>{e.description || ''}</td>
                      <td style={tdStyle}>{e.notes || ''}</td>
                      <td style={tdStyle}>{e.mood || ''}</td>
                      <td style={tdStyle}>{e.importance || ''}</td>
                      <td style={tdStyle}>{e.lifeStage || ''}</td>
                      <td style={tdStyle}>{e.source || ''}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{e.cost ? Number(e.cost).toLocaleString() + 'd' : ''}</td>
                      <td style={tdStyle}>{e.mapLink || ''}</td>
                      <td style={tdStyle}>{(e.peopleIds || []).join(', ')}</td>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={thStyle}>{vi ? 'Tieu de' : 'Title'}</th>
                    <th style={thStyle}>{vi ? 'Ngay' : 'Date'}</th>
                    <th style={thStyle}>{vi ? 'Tam trang' : 'Mood'}</th>
                    <th style={thStyle}>{vi ? 'Noi dung' : 'Content'}</th>
                    <th style={thStyle}>{vi ? 'Event lien quan' : 'Related Event'}</th>
                    <th style={thStyle}>{vi ? 'Nguoi tham gia' : 'Participants'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMemories.map(m => {
                    const linkedEv = events.find(ev => ev.id === m.eventId);
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={tdStyle}><strong>{m.title || ''}</strong></td>
                        <td style={tdStyle}>{m.date || ''}</td>
                        <td style={tdStyle}>{m.mood || ''}</td>
                        <td style={tdStyle}>{m.content?.substring(0, 300) || ''}</td>
                        <td style={tdStyle}>{linkedEv ? linkedEv.title : m.eventTitle || m.eventId || ''}</td>
                        <td style={tdStyle}>{(m.peopleIds || []).join(', ')}</td>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={thStyle}>{vi ? 'Ten' : 'Name'}</th>
                    <th style={thStyle}>{vi ? 'Gioi tinh' : 'Gender'}</th>
                    <th style={thStyle}>{vi ? 'Ngay sinh' : 'DOB'}</th>
                    <th style={thStyle}>{vi ? 'Quan he' : 'Relationship'}</th>
                    <th style={thStyle}>{vi ? 'To chuc' : 'Organization'}</th>
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
                  {people.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={tdStyle}><strong>{p.name || ''}</strong></td>
                      <td style={tdStyle}>{p.gender || ''}</td>
                      <td style={tdStyle}>{p.dob || ''}</td>
                      <td style={tdStyle}>{p.relationship || ''}</td>
                      <td style={tdStyle}>{p.organization || ''}</td>
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
