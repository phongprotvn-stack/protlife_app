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
  pdf:           { name: 'PDF Document',        icon: '📄', mime: '.pdf' },
  excel:         { name: 'Excel Spreadsheet',    icon: '📊', mime: '.xlsx' },
  word:          { name: 'Word Document',        icon: '📝', mime: '.docx' },
  'google-sheets': { name: 'Google Sheets',      icon: '📗', mime: '' },
  'google-docs':   { name: 'Google Docs',        icon: '📘', mime: '' },
  json:          { name: 'JSON Data',            icon: '🔤', mime: '.json' },
};

export default function DataHubModal({ mode, onClose }) {
  const [step, setStep] = useState(0);       // 0=choose action, 1=form, 2=result
  const [collections, setCollections] = useState({
    people: true, events: true, memories: true, places: true
  });
  const [format, setFormat] = useState('pdf');
  const [title, setTitle] = useState('ProtSphere Report');
  const [dateRange, setDateRange] = useState('');
  const [formatList, setFormatList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { showToast } = useApp();

  useEffect(() => {
    if (['report', 'export'].includes(mode)) {
      apiDataHub.listFormats()
        .then(r => setFormatList(r.formats || []))
        .catch(() => {});
    }
  }, [mode]);

  const toggleColl = (key) =>
    setCollections(p => ({ ...p, [key]: !p[key] }));

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
      showToast('✅ JSON exported successfully');
      setResult({ type: 'success', message: 'File downloaded!' });
    } catch (e) {
      showToast('❌ Export failed: ' + e.message);
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
            showToast(`✅ Imported: ${r.created || items.length} records`);
            setResult({ type: 'success', message: `Created: ${r.created}, Updated: ${r.updated || 0}` });
          } else {
            showToast('⚠️ No records found in JSON');
            setResult({ type: 'error', message: 'Empty data' });
          }
        } catch (e) {
          showToast('❌ Import failed: ' + e.message);
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
      showToast(`✅ Imported: ${r.created} created, ${r.updated} updated`);
      setResult({ type: 'success', message: `Created: ${r.created}, Updated: ${r.updated}` });
    } catch (e) {
      showToast('❌ Import failed: ' + e.message);
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
        // Read as base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const base64 = e.target.result.split(',')[1];
            const parsed = await apiDataHub.parseFile(base64, file.name, file.type);
            if (!parsed.rows || parsed.rows.length === 0) {
              showToast('⚠️ No data found in file');
              setResult({ type: 'error', message: 'No data found' });
            } else {
              // Show preview then import
              const confirmed = confirm(
                `Found ${parsed.total} rows in "${file.name}"\nDetected: ${(parsed.collections || ['data']).join(', ')}\n\nImport now?`
              );
              if (confirmed) {
                const r = await apiDataHub.importJson(parsed.rows);
                showToast(`✅ Imported: ${r.created} created, ${r.updated} updated`);
                setResult({ type: 'success', message: `Created: ${r.created}, Updated: ${r.updated}` });
              } else {
                setResult({ type: 'info', message: `Cancelled — ${parsed.total} rows parsed but not imported` });
              }
            }
          } catch (err) {
            showToast('❌ Parse failed: ' + err.message);
            setResult({ type: 'error', message: err.message });
          }
          setLoading(false);
        };
        reader.readAsDataURL(file);
      } catch (e) {
        showToast('❌ Failed to read file');
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
      showToast('⚠️ Select at least one collection');
      return;
    }
    setLoading(true);
    try {
      const data = await apiDataHub.exportReport(format, {
        collections: selected,
        title: title || 'ProtSphere Report',
        dateRange,
        includeStats: true,
      });
      // For binary formats, download as blob
      const blob = new Blob([data], { type: data.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = FORMAT_DISPLAY[format]?.mime || '.bin';
      a.download = `report_${new Date().toISOString().split('T')[0]}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ Report generated!');
    } catch (e) {
      showToast('❌ Report failed: ' + e.message);
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
            {mode === 'import' ? 'Import Data'
              : mode === 'export' ? 'Export Data'
              : mode === 'report' ? 'Generate Report'
              : 'Data Hub'}
          </span>
        </div>

        <div style={{ padding: 20, maxHeight: 400, overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={styles.spinner}></div>
              <p style={{ marginTop: 10, color: '#6B7280' }}>Processing...</p>
            </div>
          )}

          {!loading && mode === 'import' && (
            <div>
              <ActionBtn icon="📗" label="Google Sheets" desc="Import from CSV URL"
                onClick={handleImportSheet} color="#059669" />
              <ActionBtn icon="🔤" label="JSON File" desc="Upload .json file"
                onClick={handleImportJson} color="#3B82F6" />
              <ActionBtn icon="📊" label="Excel / Word File" desc="Upload .xlsx, .xls, .docx"
                onClick={handleImportFile} color="#7C3AED" />
            </div>
          )}

          {!loading && mode === 'export' && (
            <div>
              <ActionBtn icon="🔤" label="JSON Dump" desc="Download all data as JSON"
                onClick={handleExportJson} color="#3B82F6" />
              <ActionBtn icon="📊" label="Generate Report" desc="PDF, Excel, Word, Google"
                onClick={() => { setMode && setMode('report'); setFormatList(formatList); }} color="#7C3AED" />
            </div>
          )}

          {!loading && mode === 'report' && (
            <div>
              {/* Title */}
              <label style={styles.label}>Report Title</label>
              <input style={styles.input} value={title}
                onChange={e => setTitle(e.target.value)} placeholder="My Report" />

              {/* Format */}
              <label style={styles.label}>Format</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {Object.entries(FORMAT_DISPLAY).map(([key, f]) => (
                  <div key={key} onClick={() => setFormat(key)}
                    style={{
                      ...styles.chip,
                      background: format === key ? '#7C3AED' : '#F3F4F6',
                      color: format === key ? '#fff' : '#374151',
                    }}>
                    <span>{f.icon}</span>
                    <span style={{ marginLeft: 4, fontSize: 11 }}>{f.name}</span>
                  </div>
                ))}
              </div>

              {/* Collections */}
              <label style={styles.label}>Include</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {Object.entries(collections).map(([key, val]) => (
                  <div key={key} onClick={() => toggleColl(key)}
                    style={{
                      ...styles.chip,
                      background: val ? '#10B981' : '#F3F4F6',
                      color: val ? '#fff' : '#374151',
                    }}>
                    {val ? '✓' : '○'} {key.charAt(0).toUpperCase() + key.slice(1)}
                  </div>
                ))}
              </div>

              {/* Date Range */}
              <label style={styles.label}>Date Range (optional)</label>
              <input style={styles.input} value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                placeholder="e.g., 2024-01 to 2024-12" />

              {/* Generate */}
              <button onClick={handleGenerateReport} style={styles.genBtn}>
                📊 Generate Report
              </button>
            </div>
          )}

          {result && (
            <div style={{
              padding: 16, borderRadius: 12,
              background: result.type === 'success' ? '#D1FAE5' : '#FEE2E2',
              color: result.type === 'success' ? '#065F46' : '#991B1B',
            }}>
              {result.type === 'success' ? '✅ ' : '❌ '}
              {result.message}
            </div>
          )}
        </div>

        {/* Close */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6', textAlign: 'right' }}>
          <button onClick={onClose} style={styles.closeBtn}>Close</button>
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

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: 400, maxWidth: '90vw', borderRadius: 20,
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
  genBtn: {
    width: '100%', padding: 12, borderRadius: 12,
    background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 700,
    border: 'none', cursor: 'pointer', marginTop: 12,
  },
  closeBtn: {
    padding: '8px 20px', borderRadius: 10,
    background: '#F3F4F6', color: '#374151', fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer',
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #E5E7EB', borderTopColor: '#7C3AED',
    animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
};
