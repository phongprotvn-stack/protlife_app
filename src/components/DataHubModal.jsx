import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { apiDataHub } from '../api/client.js';

const COVER_COLORS = {
  import: 'linear-gradient(135deg, #059669, #10B981)',
  export: 'linear-gradient(135deg, #2563EB, #3B82F6)',
  report: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
};

const ICONS = {
  import: '📥',
  export: '📤',
  report: '📊',
};

const FORMAT_DISPLAY = {
  json: { name: 'JSON',        icon: '🔤', mime: '.json', color: '#6B7280' },
  csv:  { name: 'CSV',         icon: '📋', mime: '.csv',  color: '#059669' },
  print:{ name: 'In / PDF',    icon: '🖨️', mime: '',      color: '#7C3AED' },
};

// Smart report templates
const REPORT_TEMPLATES = [
  {
    id: 'events',
    icon: '📅',
    titleVI: 'Báo cáo Sự kiện',
    titleEN: 'Events Report',
    descVI: 'Danh sách sự kiện, thời gian, địa điểm, chi phí',
    descEN: 'Event list with dates, locations, costs',
    collections: ['events'],
  },
  {
    id: 'memories',
    icon: '💭',
    titleVI: 'Báo cáo Ký ức',
    titleEN: 'Memories Report',
    descVI: 'Nhật ký ký ức theo cảm xúc, thời gian',
    descEN: 'Memory journal by mood and date',
    collections: ['memories'],
  },
  {
    id: 'relationships',
    icon: '👥',
    titleVI: 'Báo cáo Quan hệ',
    titleEN: 'Relationships Report',
    descVI: 'Danh sách liên hệ, sự kiện & ký ức liên quan',
    descEN: 'Contacts with related events and memories',
    collections: ['people', 'events', 'memories'],
  },
  {
    id: 'full',
    icon: '📊',
    titleVI: 'Báo cáo Tổng quan',
    titleEN: 'Full Life Report',
    descVI: 'Toàn bộ dữ liệu: con người, sự kiện, ký ức, địa điểm',
    descEN: 'All data: people, events, memories, places',
    collections: ['people', 'events', 'memories', 'places'],
  },
];

export default function DataHubModal({ mode, onClose }) {
  const { lang, showToast, people, events, memories, places } = useApp();
  const vi = lang === 'vi';

  const [preview, setPreview] = useState(null); // { title, html }
  const [previewType, setPreviewType] = useState(null); // template id
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleExportJson = async () => {
    setLoading(true);
    try {
      const data = await apiDataHub.exportJson();
      const blob = new Blob(['\ufeff' + JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protlife_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ ' + (vi ? 'Xuất JSON thành công' : 'JSON exported'));
    } catch (e) {
      showToast('❌ ' + (vi ? 'Xuất thất bại' : 'Export failed') + ': ' + e.message);
    }
    setLoading(false);
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          setLoading(true);
          const data = JSON.parse(ev.target.result);
          const items = data.people || (Array.isArray(data) ? data : null) || [data];
          if (items.length > 0) {
            const r = await apiDataHub.importJson(items);
            showToast(`✅ ${vi ? 'Đã import' : 'Imported'}: ${r.created || items.length} records`);
          } else {
            showToast('⚠️ ' + (vi ? 'Không có dữ liệu' : 'No records found'));
          }
        } catch (e) {
          showToast('❌ ' + (vi ? 'Import thất bại' : 'Import failed') + ': ' + e.message);
        }
        setLoading(false);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleImportSheet = async () => {
    const url = prompt('Paste Google Sheets CSV URL:');
    if (!url) return;
    setLoading(true);
    try {
      const r = await apiDataHub.importSheets(url);
      showToast(`✅ ${vi ? 'Đã import' : 'Imported'}: ${r.created} new, ${r.updated} updated`);
    } catch (e) {
      showToast('❌ ' + (vi ? 'Import thất bại' : 'Import failed') + ': ' + e.message);
    }
    setLoading(false);
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.docx';
    input.onchange = async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      setLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64 = e.target.result.split(',')[1];
            const parsed = await apiDataHub.parseFile(base64, file.name, file.type);
            if (!parsed.rows || parsed.rows.length === 0) {
              showToast('⚠️ ' + (vi ? 'Không có dữ liệu' : 'No data found'));
            } else {
              const confirmed = confirm(
                `${vi ? 'Tìm thấy' : 'Found'} ${parsed.total} rows\n${vi ? 'Import ngay?' : 'Import now?'}`
              );
              if (confirmed) {
                const r = await apiDataHub.importJson(parsed.rows);
                showToast(`✅ ${vi ? 'Đã import' : 'Imported'}: ${r.created} created, ${r.updated} updated`);
              }
            }
          } catch (err) {
            showToast('❌ ' + (vi ? 'Phân tích thất bại' : 'Parse failed') + ': ' + err.message);
          }
          setLoading(false);
        };
        reader.readAsDataURL(file);
      } catch (e) {
        showToast('❌ ' + (vi ? 'Đọc file thất bại' : 'Failed to read file'));
        setLoading(false);
      }
    };
    input.click();
  };

  // ── Generate HTML report preview from context data ──
  const generatePreview = (tmpl) => {
    setLoading(true);
    setResult(null);

    // Filter data by collection
    const showEvents = tmpl.collections.includes('events');
    const showMemories = tmpl.collections.includes('memories');
    const showPeople = tmpl.collections.includes('people');
    const showPlaces = tmpl.collections.includes('places');

    const title = vi ? tmpl.titleVI : tmpl.titleEN;
    const now = new Date().toLocaleDateString(vi ? 'vi-VN' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const eventEmoji = (tp) => {
      const map = { meeting: '🤝', birthday: '🎂', travel: '✈️', work: '💼',
        sport: '🏆', hospital: '🏥', meal: '🍽️', call: '📞',
        shopping: '🛍️', study: '📚', party: '🎉', dating: '💑', appointment: '📅' };
      return map[tp] || '📌';
    };

    const moodEmoji = (m) => {
      const map = { Happy: '😊', Normal: '😐', Sad: '😢', Excited: '🤩', Tired: '😴', Angry: '😠', Thoughtful: '🤔', Loved: '😍' };
      return map[m] || '';
    };

    // Build HTML
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             color: #1F2937; background: #fff; padding: 32px; max-width: 900px; margin: 0 auto; }
      h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; color: #111827; }
      .meta { font-size: 13px; color: #9CA3AF; margin-bottom: 24px; }
      .stat-bar { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
      .stat { background: #F9FAFB; border-radius: 12px; padding: 12px 20px; flex: 1; min-width: 100px; text-align: center; }
      .stat-num { font-size: 28px; font-weight: 800; color: #E6002D; }
      .stat-label { font-size: 11px; color: #9CA3AF; font-weight: 600; margin-top: 2px; }
      h2 { font-size: 18px; font-weight: 700; margin: 28px 0 12px; color: #111827;
           border-bottom: 2px solid #F3F4F6; padding-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
      th { background: #F3F4F6; font-weight: 700; text-align: left; padding: 10px 12px;
           color: #374151; font-size: 12px; border-bottom: 2px solid #E5E7EB; }
      td { padding: 9px 12px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
      tr:hover td { background: #F9FAFB; }
      .chip { display: inline-block; padding: 2px 8px; border-radius: 10px;
              font-size: 11px; font-weight: 600; background: #F3F4F6; color: #374151; }
      .score { font-weight: 700; color: #E6002D; }
      .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #D1D5DB; }
      .memo-item { padding: 12px 16px; border: 1px solid #F3F4F6; border-radius: 10px;
                   margin-bottom: 8px; }
      .memo-item h3 { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
      .memo-item .sub { font-size: 12px; color: #6B7280; }
      .memo-item .mood { font-size: 14px; }
      .cost { font-weight: 600; color: #059669; }
    </style>
    <title>${title}</title></head><body>
    <h1>${tmpl.icon} ${title}</h1>
    <div class="meta">📅 ${now} · ${vi ? 'ProtLife OS' : 'ProtLife OS'}</div>`;

    // Statistics
    if (showPeople || showEvents || showMemories || showPlaces) {
      html += `<div class="stat-bar">`;
      if (showPeople)   html += `<div class="stat"><div class="stat-num">${people.length}</div><div class="stat-label">${vi ? 'Người' : 'People'}</div></div>`;
      if (showEvents)   html += `<div class="stat"><div class="stat-num">${events.length}</div><div class="stat-label">${vi ? 'Sự kiện' : 'Events'}</div></div>`;
      if (showMemories) html += `<div class="stat"><div class="stat-num">${memories.length}</div><div class="stat-label">${vi ? 'Ký ức' : 'Memories'}</div></div>`;
      if (showPlaces)   html += `<div class="stat"><div class="stat-num">${places.length}</div><div class="stat-label">${vi ? 'Địa điểm' : 'Places'}</div></div>`;
      html += `</div>`;
    }

    // Events table
    if (showEvents && events.length > 0) {
      html += `<h2>📅 ${vi ? 'Danh sách Sự kiện' : 'Events'} (${events.length})</h2>
      <table><thead><tr>
        <th>${vi ? 'Tên' : 'Title'}</th>
        <th>${vi ? 'Ngày' : 'Date'}</th>
        <th>${vi ? 'Thể loại' : 'Type'}</th>
        <th>${vi ? 'Địa điểm' : 'Location'}</th>
        <th>${vi ? 'Chi phí' : 'Cost'}</th>
      </tr></thead><tbody>`;
      for (const e of events) {
        html += `<tr>
          <td><strong>${e.title || ''}</strong></td>
          <td>${e.date || ''}${e.endDate ? ` → ${e.endDate}` : ''}</td>
          <td>${eventEmoji(e.eventType)} <span class="chip">${e.eventType || ''}</span></td>
          <td>${e.locationName || e.location || ''}</td>
          <td class="cost">${e.cost ? `${Number(e.cost).toLocaleString()}đ` : ''}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
    }

    // Memories list
    if (showMemories && memories.length > 0) {
      html += `<h2>💭 ${vi ? 'Danh sách Ký ức' : 'Memories'} (${memories.length})</h2>`;
      for (const m of memories) {
        const linkedEv = events.find(ev => ev.id === m.eventId);
        html += `<div class="memo-item">
          <h3>${moodEmoji(m.mood)} ${m.title || 'Untitled'}</h3>
          <div class="sub">📅 ${m.date || ''}${m.mood ? ` · <span class="mood">🎭 ${m.mood}</span>` : ''}</div>
          ${m.content ? `<div style="margin-top:6px;color:#4B5563;font-size:12px">${m.content.substring(0, 300)}</div>` : ''}
          ${linkedEv ? `<div style="margin-top:4px;font-size:12px;color:#7C3AED">📌 ${linkedEv.title}</div>` : ''}
        </div>`;
      }
    }

    // People table
    if (showPeople && people.length > 0) {
      html += `<h2>👥 ${vi ? 'Danh sách Quan hệ' : 'Relationships'} (${people.length})</h2>
      <table><thead><tr>
        <th>${vi ? 'Tên' : 'Name'}</th>
        <th>${vi ? 'Quan hệ' : 'Relationship'}</th>
        <th>${vi ? 'Điểm' : 'Score'}</th>
        <th>${vi ? 'Trạng thái' : 'Status'}</th>
        <th>${vi ? 'Nguồn' : 'Source'}</th>
      </tr></thead><tbody>`;
      for (const p of people) {
        html += `<tr>
          <td><strong>${p.name || ''}</strong></td>
          <td>${p.relationship || ''}</td>
          <td class="score">${p.relationshipScore || 0}</td>
          <td>${p.status || ''}</td>
          <td>${p.source || ''}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
    }

    // Places
    if (showPlaces && places.length > 0) {
      html += `<h2>📍 ${vi ? 'Danh sách Địa điểm' : 'Places'} (${places.length})</h2>`;
      for (const p of places) {
        html += `<div class="memo-item">
          <h3>📍 ${p.name || 'Unnamed'}</h3>
          <div class="sub">${p.address || ''}</div>
        </div>`;
      }
    }

    html += `<div class="footer">${vi ? 'Được tạo bởi' : 'Generated by'} ProtLife OS v2.0.0</div></body></html>`;

    setPreview({ title, html });
    setPreviewType(tmpl.id);
    setLoading(false);
  };

  // ── Download handlers ──
  const downloadAsJson = () => {
    const exportData = {};
    if (previewType === 'events' || previewType === 'full' || previewType === 'relationships') {
      exportData.events = events.map(e => ({ ...e }));
    }
    if (previewType === 'memories' || previewType === 'full' || previewType === 'relationships') {
      exportData.memories = memories.map(m => ({ ...m }));
    }
    if (previewType === 'relationships' || previewType === 'full') {
      exportData.people = people.map(p => ({ ...p }));
    }
    if (previewType === 'full') {
      exportData.places = places.map(p => ({ ...p }));
    }
    exportData.exportedAt = new Date().toISOString();
    exportData.version = '2.0.0';
    const blob = new Blob(['\ufeff' + JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${previewType}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsCsv = () => {
    let csv = '\ufeff';

    const toCsvRow = (row) => row.map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');

    if (previewType === 'events' || previewType === 'full' || previewType === 'relationships') {
      csv += toCsvRow(['Title', 'Date', 'End Date', 'Type', 'Location', 'Mood', 'Cost', 'Notes']) + '\n';
      for (const e of events) {
        csv += toCsvRow([e.title, e.date, e.endDate, e.eventType, e.locationName || e.location, e.mood, e.cost, e.notes]) + '\n';
      }
    }
    if (previewType === 'memories' || previewType === 'full' || previewType === 'relationships') {
      csv += '\n' + toCsvRow(['Memory Title', 'Date', 'Mood', 'Content', 'EventID']) + '\n';
      for (const m of memories) {
        csv += toCsvRow([m.title, m.date, m.mood, m.content?.substring(0, 200), m.eventId]) + '\n';
      }
    }
    if (previewType === 'relationships' || previewType === 'full') {
      csv += '\n' + toCsvRow(['Name', 'Relationship', 'Score', 'Status', 'Source', 'Phone']) + '\n';
      for (const p of people) {
        csv += toCsvRow([p.name, p.relationship, p.relationshipScore, p.status, p.source,
          Array.isArray(p.phones) ? p.phones.join('; ') : p.phones]) + '\n';
      }
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${previewType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(preview.html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  const doDownload = (fmt) => {
    setShowFormatPicker(false);
    if (fmt === 'json') downloadAsJson();
    else if (fmt === 'csv') downloadAsCsv();
    else if (fmt === 'print') printReport();
    showToast('✅ ' + (vi ? 'Đã tải xuống!' : 'Downloaded!'));
  };

  // ── Header title ──
  const headerTitle = preview
    ? preview.title
    : mode === 'import' ? (vi ? 'Import Dữ liệu' : 'Import Data')
      : mode === 'export' ? (vi ? 'Xuất Dữ liệu' : 'Export Data')
        : 'Data Hub';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ ...styles.header, background: COVER_COLORS[mode] || COVER_COLORS.export }}>
          <span style={{ fontSize: 20 }}>{preview ? '📊' : (ICONS[mode] || '📦')}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginLeft: 10, flex: 1 }}>
            {headerTitle}
          </span>
          {preview && (
            <span onClick={() => { setPreview(null); setPreviewType(null); }}
              style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              ✕ {vi ? 'Đóng' : 'Close'}
            </span>
          )}
        </div>

        <div style={{ padding: 20, maxHeight: preview ? 480 : 420, overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={styles.spinner}></div>
              <p style={{ marginTop: 10, color: '#6B7280' }}>{vi ? 'Đang xử lý...' : 'Processing...'}</p>
            </div>
          )}

          {/* ── IMPORT MODE ── */}
          {!loading && !preview && mode === 'import' && (
            <div>
              <ActionBtn icon="📗" label="Google Sheets" desc={vi ? 'Import từ URL CSV' : 'Import from CSV URL'}
                onClick={handleImportSheet} color="#059669" />
              <ActionBtn icon="🔤" label="JSON File" desc={vi ? 'Upload file .json' : 'Upload .json file'}
                onClick={handleImportJson} color="#3B82F6" />
              <ActionBtn icon="📊" label="Excel / Word File" desc={vi ? 'Upload .xlsx, .xls, .docx' : 'Upload .xlsx, .xls, .docx'}
                onClick={handleImportFile} color="#7C3AED" />
            </div>
          )}

          {/* ── EXPORT MODE (no preview yet) ── */}
          {!loading && !preview && mode === 'export' && (
            <div>
              <ActionBtn icon="🔤" label="JSON Dump" desc={vi ? 'Tải xuống toàn bộ dữ liệu' : 'Download all data as JSON'}
                onClick={handleExportJson} color="#3B82F6" />
              <div style={{ marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>
                {vi ? 'HOẶC TẠO BÁO CÁO' : 'OR GENERATE REPORT'} →
              </div>
              <ReportTemplateSelector onSelect={generatePreview} lang={lang} />
            </div>
          )}

          {/* ── REPORT MODE (no preview yet) ── */}
          {!loading && !preview && mode === 'report' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 12 }}>
                {vi ? 'Chọn loại báo cáo:' : 'Select report type:'}
              </div>
              <ReportTemplateSelector onSelect={generatePreview} lang={lang} />
            </div>
          )}

          {/* ── REPORT PREVIEW ── */}
          {!loading && preview && (
            <div>
              {/* Report rendered in iframe for clean styling */}
              <div style={{
                border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden',
                background: '#fff', marginBottom: 16,
              }}>
                <iframe
                  srcDoc={preview.html}
                  style={{ width: '100%', height: 400, border: 'none' }}
                  title={preview.title}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setPreview(null); setPreviewType(null); }}
                  className="btn-secondary" style={{ flex: 1, padding: 12, borderRadius: 12 }}>
                  ← {vi ? 'Chọn lại' : 'Back'}
                </button>
                <button onClick={() => setShowFormatPicker(true)} style={{
                  flex: 2, padding: 12, borderRadius: 12,
                  background: '#E6002D', color: '#fff', fontSize: 14, fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6,
                }}>
                  ⬇️ {vi ? 'Tải xuống' : 'Download'}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div style={{
              padding: 12, borderRadius: 10, marginTop: 12,
              background: result.type === 'success' ? '#D1FAE5' : '#FEE2E2',
              color: result.type === 'success' ? '#065F46' : '#991B1B',
              fontSize: 13, fontWeight: 600,
            }}>
              {result.type === 'success' ? '✅ ' : '❌ '}
              {result.message}
            </div>
          )}
        </div>

        {/* Footer close */}
        {!preview && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6', textAlign: 'right' }}>
            <button onClick={onClose} style={{
              padding: '8px 20px', borderRadius: 10,
              background: '#F3F4F6', color: '#374151', fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer',
            }}>{vi ? 'Đóng' : 'Close'}</button>
          </div>
        )}

        {/* ── FORMAT PICKER OVERLAY ── */}
        {showFormatPicker && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            borderRadius: 20, zIndex: 10,
          }}>
            <div style={{
              background: '#fff', margin: '0 20px', borderRadius: 16,
              padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
                {vi ? 'Chọn định dạng tải xuống' : 'Choose download format'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(FORMAT_DISPLAY).map(([key, f]) => (
                  <div key={key} onClick={() => doDownload(key)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 12,
                    cursor: 'pointer', background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: f.color + '20', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>{f.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        {key === 'json' ? (vi ? 'Dữ liệu thô, có thể import lại' : 'Raw data, re-importable')
                          : key === 'csv' ? (vi ? 'Mở được bằng Excel, Google Sheets' : 'Open in Excel, Google Sheets')
                          : key === 'print' ? (vi ? 'In hoặc lưu PDF từ trình duyệt' : 'Print or save as PDF') : ''}
                      </div>
                    </div>
                    <span style={{ color: f.color }}>→</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowFormatPicker(false)} style={{
                width: '100%', marginTop: 12, padding: 10, borderRadius: 10,
                background: '#F3F4F6', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: '#6B7280',
              }}>{vi ? 'Huỷ' : 'Cancel'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, desc, onClick, color }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
      background: '#F9FAFB', marginBottom: 8,
      border: '1px solid #E5E7EB',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>{desc}</div>
      </div>
      <span style={{ color }}>→</span>
    </div>
  );
}

function ReportTemplateSelector({ onSelect, lang }) {
  const vi = lang === 'vi';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {REPORT_TEMPLATES.map(tmpl => (
        <div key={tmpl.id} onClick={() => onSelect(tmpl)} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
          background: '#F9FAFB', border: '1px solid #E5E7EB',
          transition: 'all 0.15s',
        }}>
          <span style={{ fontSize: 24 }}>{tmpl.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              {vi ? tmpl.titleVI : tmpl.titleEN}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
              {vi ? tmpl.descVI : tmpl.descEN}
            </div>
          </div>
          <span style={{ color: '#7C3AED', fontSize: 18 }}>→</span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: 520, maxWidth: '90vw', borderRadius: 20,
    background: '#fff', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    position: 'relative',
  },
  header: {
    padding: '20px 24px', display: 'flex', alignItems: 'center',
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #E5E7EB', borderTopColor: '#7C3AED',
    animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
};
