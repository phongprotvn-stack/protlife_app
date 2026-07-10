import { useState, useRef, useEffect } from 'react';

const GROUP_COLORS = ['#E6002D','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#6366F1','#14B8A6','#F97316','#84CC16','#06B6D4','#A855F7'];

// ─── GroupSelector: combobox — gõ tên tổ chức, gợi ý từ danh sách, Enter = thêm mới ───
export default function GroupSelector({ groups, values = [], onChange, addGroup }) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = input.trim()
    ? groups.filter(g =>
        g.name.toLowerCase().includes(input.toLowerCase()) &&
        !values.includes(g.name)
      ).slice(0, 8)
    : [];

  const addOrg = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let groupAdded = false;
    if (!groups.find(g => g.name === trimmed) && addGroup) {
      try {
        const newGroup = await addGroup({ name: trimmed, color: GROUP_COLORS[groups.length % GROUP_COLORS.length] });
        if (newGroup && newGroup.id) groupAdded = true;
      } catch (e) {
        // Group creation failed, still add to values
      }
    }
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
    setFocused(false);
  };

  const removeOrg = (name) => {
    onChange(values.filter(v => v !== name));
  };

  return (
    <div ref={wrapperRef}>
      {/* Selected chips */}
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {values.map(name => {
            const g = groups.find(x => x.name === name);
            return (
              <span key={name} className="chip active" style={{ fontSize: 11, borderLeft: g ? `3px solid ${g.color}` : '3px solid #6366F1' }}>
                {name}
                <span style={{ marginLeft: 6, cursor: 'pointer', opacity: 0.5 }} onClick={() => removeOrg(name)}>✕</span>
              </span>
            );
          })}
        </div>
      )}
      {/* Combobox input */}
      <div style={{ position: 'relative' }}>
        <input
          className="input-pill"
          style={{ width: '100%' }}
          placeholder={values.length > 0 ? 'Gõ thêm tổ chức...' : 'Gõ tên tổ chức hoặc chọn...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addOrg(input); }
            if (e.key === 'Escape') { setFocused(false); setInput(''); }
          }}
        />
        {/* Suggestions dropdown */}
        {focused && (input.trim() || groups.length > 0) && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 50, marginTop: 4, maxHeight: 240, overflowY: 'auto', padding: 4,
          }}>
            {/* Show available groups when there's input (filtered) */}
            {(input.trim() ? suggestions : groups.filter(g => !values.includes(g.name))).slice(0, 8).map(g => (
              <div key={g.id}
                style={{ padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => e.target.style.background = '#F3F4F6'}
                onMouseLeave={e => e.target.style.background = 'transparent'}
                onClick={() => addOrg(g.name)}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color || '#9CA3AF', flexShrink: 0 }} />
                {g.name}
              </div>
            ))}
            {/* "Add new" option when input doesn't match any existing group */}
            {input.trim() && !groups.some(g => g.name.toLowerCase() === input.trim().toLowerCase()) && (
              <div
                style={{ padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, color: '#6366F1', fontWeight: 600 }}
                onMouseEnter={e => e.target.style.background = '#EEF2FF'}
                onMouseLeave={e => e.target.style.background = 'transparent'}
                onClick={() => addOrg(input)}>
                + Thêm "{input.trim()}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GroupManager: manage organizations (same as before) ───
export function GroupManager({ groups, addGroup, updateGroup, deleteGroup, onClose }) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    addGroup({ name: newName.trim(), color });
    setNewName('');
  };

  const handleRename = (id, name) => {
    if (!name.trim()) return;
    updateGroup(id, { name: name.trim() });
    setEditing(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 200 }}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Quản lý tổ chức</div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <input className="input-pill" style={{ flex: 1 }} placeholder="Tên tổ chức mới..."
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="btn-primary" onClick={handleAdd} disabled={!newName.trim()}>Thêm</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groups.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#F9FAFB', borderRadius: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color || '#9CA3AF', flexShrink: 0 }} />
              {editing === g.id ? (
                <input className="input-pill" style={{ flex: 1, fontSize: 13 }}
                  defaultValue={g.name}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(g.id, e.target.value); if (e.key === 'Escape') setEditing(null); }}
                  onBlur={e => handleRename(g.id, e.target.value)}
                  autoFocus />
              ) : (
                <span style={{ flex: 1, fontSize: 13 }}>{g.name}</span>
              )}
              <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => setEditing(editing === g.id ? null : g.id)}>
                {editing === g.id ? 'Xong' : 'Sửa'}
              </button>
              <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11, color: '#E6002D' }}
                onClick={() => deleteGroup(g.id)}>Xoá</button>
            </div>
          ))}
          {groups.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Chưa có tổ chức nào</div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
