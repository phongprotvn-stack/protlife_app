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
  pdf:           { name: 'PDF Document',        icon: '📄', mime: '.pdf', color: '#DC2626' },
  excel:         { name: 'Excel Spreadsheet',    icon: '📊', mime: '.xlsx', color: '#059669' },
  word:          { name: 'Word Document',        icon: '📝', mime: '.docx', color: '#2563EB' },
  'google-sheets': { name: 'Google Sheets',      icon: '📗', mime: '', color: '#0F9D58' },
  'google-docs':   { name: 'Google Docs',        icon: '📘', mime: '', color: '#4285F4' },
  json:          { name: 'JSON Data',            icon: '🔤', mime: '.json', color: '#6B7280' },
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
  const [step, setStep] = useState(0);
  const [collections, setCollections] = useState({
    people: true, events: true, memories: true, places: true
  });
  const [format, setFormat] = useState('pdf');
  const [title, setTitle] = useState('ProtLife Report');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formatList, setFormatList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { lang, showToast } = useApp();
  const vi = lang === 'vi';

  useEffect(() => {
    if (['report', 'export'].includes(mode)) {
      apiDataHub.listFormats()
        .then(r => setFormatList(r.formats || []))
        .catch(() => {});
    }
  }, [mode]);

  const toggleColl = (key) =>
    setCollections(p => ({ ...p, [key]: !p[key] }));

  const applyTemplate = (tmpl) => {
    const colls = {};
    for (const c of ['people', 'events', 'memories', 'places']) {
      colls[c] = tmpl.collections.includes(c);
    }
    setCollections(colls);
    setTitle(vi ? tmpl.titleVI : tmpl.titleEN);
    setStep(1);
  };

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
      setResult({ type: 'success', message: vi ? 'File đã tải xuống!' : 'File downloaded!' });
    } catch (e) {
      showToast('❌ ' + (vi ? 'Xuất thất bại' : 'Export failed') + ': ' + e.message);
      setResult({ type: 'error', message: e.message });
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
            setResult({ type: 'success', message: `${vi ? 'Đã tạo' : 'Created'}: ${r.created}, ${vi ? 'Cập nhật' : 'Updated'}: ${r.updated || 0}` });
          } else {
            showToast('⚠️ ' + (vi ? 'Không có dữ liệu' : 'No records found'));
            setResult({ type: 'error', message: vi ? 'Dữ liệu rỗng' : 'Empty data' });
          }
        } catch (e) {
          showToast('❌ ' + (vi ? 'Import thất bại' : 'Import failed') + ': ' + e.message);
          setResult({ type: 'error', message: e.message });
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
      showToast(`✅ ${vi ? 'Đã import' : 'Imported'}: ${r.created} ${vi ? 'tạo mới' : 'created'}, ${r.updated} ${vi ? 'cập nhật' : 'updated'}`);
      setResult({ type: 'success', message: `${vi ? 'Đã tạo' : 'Created'}: ${r.created}, ${vi ? 'Cập nhật' : 'Updated'}: ${r.updated}` });
    } catch (e) {
      showToast('❌ ' + (vi ? 'Import thất bại' : 'Import failed') + ': ' + e.message);
      setResult({ type: 'error', message: e.message });
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
              setResult({ type: 'error', message: vi ? 'Không có dữ liệu' : 'No data found' });
            } else {
              const confirmed = confirm(
                `${vi ? 'Tìm thấy' : 'Found'} ${parsed.total} rows\n${vi ? 'Phát hiện' : 'Detected'}: ${(parsed.collections || ['data']).join(', ')}\n\n${vi ? 'Import ngay?' : 'Import now?'}`
              );
              if (confirmed) {
                const r = await apiDataHub.importJson(parsed.rows);
                showToast(`✅ ${vi ? 'Đã import' : 'Imported'}: ${r.created} ${vi ? 'tạo mới' : 'created'}, ${r.updated} ${vi ? 'cập nhật' : 'updated'}`);
                setResult({ type: 'success', message: `${vi ? 'Đã tạo' : 'Created'}: ${r.created}, ${vi ? 'Cập nhật' : 'Updated'}: ${r.updated}` });
              } else {
                setResult({ type: 'info', message: `${vi ? 'Đã huỷ' : 'Cancelled'} — ${parsed.total} rows parsed` });
              }
            }
          } catch (err) {
            showToast('❌ ' + (vi ? 'Phân tích thất bại' : 'Parse failed') + ': ' + err.message);
            setResult({ type: 'error', message: err.message });
          }
          setLoading(false);
        };
        reader.readAsDataURL(file);
      } catch (e) {
        showToast('❌ ' + (vi ? 'Đọc file thất bại' : 'Failed to read file'));
        setResult({ type: 'error', message: e.message });
        setLoading(false);
      }
    };
    input.click();
  };

  const handleGenerateReport = async () => {
    const selected = Object.entries(collections)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (selected.length === 0) {
      showToast('⚠️ ' + (vi ? 'Chọn ít nhất 1 loại dữ liệu' : 'Select at least one collection'));
      return;
    }
    setLoading(true);
    try {
      const dateRange = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom || dateTo;
      const data = await apiDataHub.exportReport(format, {
        collections: selected,
        title: title || 'ProtLife Report',
        dateRange,
        includeStats: true,
      });
      const blob = new Blob([data], { type: data.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = FORMAT_DISPLAY[format]?.mime || '.bin';
      a.download = `${title.replace(/[^a-zA-Z0-9_À-ÿ]/g, '_')}_${new Date().toISOString().split('T')[0]}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ ' + (vi ? 'Đã tạo báo cáo!' : 'Report generated!'));
    } catch (e) {
      showToast('❌ ' + (vi ? 'Tạo báo cáo thất bại' : 'Report failed') + ': ' + e.message);
      setResult({ type: 'error', message: e.message });
    }
    setLoading(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ ...styles.header, background: COVER_COLORS[mode] || COVER_COLORS.export }}>
          <span style={{ fontSize: 20 }}>{ICONS[mode] || '📦'}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginLeft: 10 }}>
            {mode === 'import' ? (vi ? 'Import Dữ liệu' : 'Import Data')
              : mode === 'export' ? (vi ? 'Xuất Dữ liệu' : 'Export Data')
              : mode === 'report' ? (vi ? 'Tạo Báo cáo' : 'Generate Report')
              : 'Data Hub'}
          </span>
        </div>

        <div style={{ padding: 20, maxHeight: 420, overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={styles.spinner}></div>
              <p style={{ marginTop: 10, color: '#6B7280' }}>{vi ? 'Đang xử lý...' : 'Processing...'}</p>
            </div>
          )}

          {!loading && mode === 'import' && (
            <div>
              <ActionBtn icon="📗" label="Google Sheets" desc={vi ? 'Import từ URL CSV' : 'Import from CSV URL'}
                onClick={handleImportSheet} color="#059669" />
              <ActionBtn icon="🔤" label="JSON File" desc={vi ? 'Upload file .json' : 'Upload .json file'}
                onClick={handleImportJson} color="#3B82F6" />
              <ActionBtn icon="📊" label="Excel / Word File" desc={vi ? 'Upload .xlsx, .xls, .docx' : 'Upload .xlsx, .xls, .docx'}
                onClick={handleImportFile} color="#7C3AED" />
            </div>
          )}

          {!loading && mode === 'export' && (
            <div>
              <ActionBtn icon="🔤" label="JSON Dump" desc={vi ? 'Tải xuống toàn bộ dữ liệu' : 'Download all data as JSON'}
                onClick={handleExportJson} color="#3B82F6" />
              <div style={{ marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>
                {vi ? 'HOẶC TẠO BÁO CÁO' : 'OR GENERATE REPORT'} →
              </div>
              <ReportTemplateSelector onSelect={applyTemplate} lang={lang} />
            </div>
          )}

          {!loading && (mode === 'report' || (mode === 'export' && step >= 1)) && (
            <div>
              {step === 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 12 }}>
                    {vi ? 'Chọn loại báo cáo:' : 'Select report type:'}
                  </div>
                  <ReportTemplateSelector onSelect={applyTemplate} lang={lang} />
                </div>
              )}

              {step >= 1 && (
                <div>
                  {/* Title */}
                  <label style={styles.label}>{vi ? 'Tiêu đề' : 'Report Title'}</label>
                  <input style={styles.input} value={title}
                    onChange={e => setTitle(e.target.value)} placeholder={vi ? 'Báo cáo của tôi' : 'My Report'} />

                  {/* Format */}
                  <label style={styles.label}>{vi ? 'Định dạng' : 'Format'}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {Object.entries(FORMAT_DISPLAY).map(([key, f]) => (
                      <div key={key} onClick={() => setFormat(key)}
                        style={{
                          ...styles.chip,
                          background: format === key ? f.color : '#F3F4F6',
                          color: format === key ? '#fff' : '#374151',
                        }}>
                        <span>{f.icon}</span>
                        <span style={{ marginLeft: 4, fontSize: 11 }}>{f.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Collections */}
                  <label style={styles.label}>{vi ? 'Bao gồm' : 'Include'}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {Object.entries(collections).map(([key, val]) => {
                      const labels = {
                        people: vi ? '🧑 Con người' : '👤 People',
                        events: vi ? '📅 Sự kiện' : '📅 Events',
                        memories: vi ? '💭 Ký ức' : '💭 Memories',
                        places: vi ? '📍 Địa điểm' : '📍 Places',
                      };
                      return (
                        <div key={key} onClick={() => toggleColl(key)}
                          style={{
                            ...styles.chip,
                            background: val ? '#10B981' : '#F3F4F6',
                            color: val ? '#fff' : '#374151',
                          }}>
                          {val ? '✓' : '○'} {labels[key] || key}
                        </div>
                      );
                    })}
                  </div>

                  {/* Date Range */}
                  <label style={styles.label}>{vi ? 'Khoảng thời gian (tuỳ chọn)' : 'Date Range (optional)'}</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input type="date" style={{ ...styles.input, flex: 1, marginBottom: 0 }} value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)} />
                    <span style={{ display: 'flex', alignItems: 'center', color: '#9CA3AF', fontSize: 12 }}>→</span>
                    <input type="date" style={{ ...styles.input, flex: 1, marginBottom: 0 }} value={dateTo}
                      onChange={e => setDateTo(e.target.value)} />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button className="btn-secondary" style={{ flex: 1 }}
                      onClick={() => {
                        if (mode === 'export') { setStep(0); } else { setStep(0); }
                      }}>
                      ← {vi ? 'Quay lại' : 'Back'}
                    </button>
                    <button onClick={handleGenerateReport} style={{
                      flex: 2, padding: 12, borderRadius: 12,
                      background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 700,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                    }}>
                      📊 {vi ? 'Tạo báo cáo' : 'Generate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div style={{
              padding: 12, borderRadius: 10, marginTop: 12,
              background: result.type === 'success' ? '#D1FAE5' : result.type === 'info' ? '#DBEAFE' : '#FEE2E2',
              color: result.type === 'success' ? '#065F46' : result.type === 'info' ? '#1E40AF' : '#991B1B',
              fontSize: 13, fontWeight: 600,
            }}>
              {result.type === 'success' ? '✅ ' : result.type === 'info' ? 'ℹ️ ' : '❌ '}
              {result.message}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6', textAlign: 'right' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 10,
            background: '#F3F4F6', color: '#374151', fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
          }}>{vi ? 'Đóng' : 'Close'}</button>
        </div>
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
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
              📦 {tmpl.collections.join(', ')}
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
    width: 420, maxWidth: '90vw', borderRadius: 20,
    background: '#fff', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    padding: '20px 24px', display: 'flex', alignItems: 'center',
  },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
    marginBottom: 6, marginTop: 8,
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #D1D5DB', fontSize: 13,
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  },
  chip: {
    padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center',
    transition: 'all 0.15s',
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #E5E7EB', borderTopColor: '#7C3AED',
    animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
};
