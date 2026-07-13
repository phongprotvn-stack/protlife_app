import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import {
  Plus, Search, X, Users, Tag, SlidersHorizontal,
  LayoutGrid, List, ChevronDown, Check, Globe, Phone,
  Mail, MapPin, BookOpen, User, CalendarDays
} from 'lucide-react';
import { t, formatDate, formatDateInput } from '../i18n';
import { getScoreInfo } from '../contexts/AppContext';
import GroupSelector, { GroupManager } from '../components/GroupSelector';

const SOCIAL_PLATFORMS = ['facebook', 'zalo', 'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'other'];

const RELATIONSHIP_GROUPS = [
  'Family', 'Relative', 'Friend', 'Colleague',
];

// Predefined Org 1 & Org 2 lists matching Excel import data
const ORG1_NAMES = new Set([
  '9A', 'Bạn cao học', 'Bạn du lịch', 'Bạn đại học', 'Bạn kết nối',
  'Bạn tìm hiểu', 'Bang hội', 'Gia đình', 'Họ hàng', 'Nghĩa Tân',
  'PCRT', 'Quảng Trị', 'SBV', 'TN1', 'VCB',
]);
const ORG2_NAMES = new Set(['Sư đoàn Mõm', '3 Musketeers']);

const SCORE_LEVELS = [
  { range: [1, 29], key: 'scoreAcquainted', label: 'Quen biết', emoji: '⚪' },
  { range: [30, 49], key: 'scoreFriendly', label: 'Bạn bè', emoji: '🟢' },
  { range: [50, 69], key: 'scoreCloseFriend', label: 'Thân', emoji: '🔵' },
  { range: [70, 89], key: 'scoreIntimate', label: 'Thân thiết', emoji: '🟣' },
  { range: [90, 100], key: 'scoreSoulmate', label: 'Ruột thịt', emoji: '❤️' },
];

const DEFAULT_SOCIAL = { platform: 'facebook', url: '' };

function getEmptyPerson() {
  return {
    name: '', gender: 'male', dob: '',
    phones: [], emails: [], address: '',
    socialLinks: [{ ...DEFAULT_SOCIAL }],
    relationship: '', organization: '', organizations: [], groupIds: [],
    relationshipScore: 0, status: 'Active', isFavorite: false, source: '',
    notes: '', tags: [],
    customGroup: '',
  };
}

// Normalize a person from DB to form, handling old->new schema
function normalizePerson(p) {
  const base = {
    name: p.name || '',
    gender: p.gender || 'male',
    dob: p.dob || '',
    phones: [],
    emails: [],
    address: p.address || '',
    socialLinks: [],
    relationship: p.relationship || '',
    organization: p.organization || '',
    organizations: Array.isArray(p.organizations)
      ? [...new Set(p.organizations.filter(Boolean))]
      : (p.organization ? [p.organization] : []),
    groupIds: Array.isArray(p.groupIds) ? [...p.groupIds] : (p.groupId ? [p.groupId] : []),
    relationshipScore: p.relationshipScore ?? 50,
    status: p.status || 'Active',
    isFavorite: p.isFavorite ?? false,
    source: p.source || '',
    notes: p.notes || '',
    tags: p.tags || [],
    customGroup: '',
  };

  // Phones: support both string and array
  if (Array.isArray(p.phones)) base.phones = [...p.phones];
  else if (p.phone) base.phones = [p.phone];

  // Emails: support both string and array
  if (Array.isArray(p.emails)) base.emails = [...p.emails];
  else if (p.email) base.emails = [p.email];

  // Social Links: merge old facebook/tiktok fields
  if (Array.isArray(p.socialLinks)) {
    base.socialLinks = p.socialLinks.map(s => ({ platform: s.platform || 'facebook', url: s.url || '' }));
  } else {
    const links = [];
    if (p.facebook) links.push({ platform: 'facebook', url: p.facebook });
    if (p.tiktok) links.push({ platform: 'tiktok', url: p.tiktok });
    if (p.youtube) links.push({ platform: 'youtube', url: p.youtube });
    base.socialLinks = links.length > 0 ? links : [{ ...DEFAULT_SOCIAL }];
  }

  return base;
}

// ─── Multi-value text input (no add button, Enter to add) ───
function MultiInput({ values, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) {
      onChange([...values, v]);
      setInput('');
    }
  };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        {values.map((v, i) => (
          <span key={i} className="chip active" style={{ padding: '2px 6px 2px 10px', fontSize: 12 }}>
            {v}
            <X size={12} style={{ cursor: 'pointer', marginLeft: 4, verticalAlign: 'middle' }}
              onClick={() => onChange(values.filter((_, j) => j !== i))} />
          </span>
        ))}
      </div>
      <input className="field-input" placeholder={placeholder}
        value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    </div>
  );
}

// ─── Social Links Input ───
function SocialLinksInput({ links, onChange }) {
  const addLink = () => onChange([...links, { platform: 'facebook', url: '' }]);
  const removeLink = (i) => onChange(links.filter((_, j) => j !== i));
  const updateLink = (i, field, value) => {
    const next = links.map((l, j) => j === i ? { ...l, [field]: value } : l);
    onChange(next);
  };
  return (
    <div>
      {links.map((link, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
          <select className="input-pill" style={{ width: 110, fontSize: 12, padding: '8px 6px' }}
            value={link.platform} onChange={e => updateLink(i, 'platform', e.target.value)}>
            {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <input className="input-pill" style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
            value={link.url} onChange={e => updateLink(i, 'url', e.target.value)}
            placeholder="URL hoặc ID..." />
          {links.length > 1 && (
            <X size={16} style={{ cursor: 'pointer', color: '#E6002D', flexShrink: 0 }}
              onClick={() => removeLink(i)} />
          )}
        </div>
      ))}
      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, marginTop: 2 }}
        onClick={addLink} type="button">+ Thêm mạng xã hội</button>
    </div>
  );
}

// ─── Score Level Selector + Slider ───
function ScoreSelector({ value, onChange }) {
  return (
    <div>
      <input
        type="range" min="0" max="100"
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ width: '100%', accentColor: '#E6002D', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SCORE_LEVELS.map(lv => {
          const sel = value >= lv.range[0] && value <= lv.range[1];
          const mid = Math.round((lv.range[0] + lv.range[1]) / 2);
          return (
            <button key={lv.key} type="button"
              onClick={() => onChange(mid)}
              className={`chip ${sel ? 'active' : ''}`}
              style={{
                flex: '1 0 auto', justifyContent: 'center', minWidth: 60,
                ...(sel ? {} : { opacity: 0.7 }),
              }}
            >
              {lv.emoji} {lv.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Single Org Selector: combobox with search + add new + delete ───
export function SingleOrgSelector({ label, orgs, value, onChange, addGroup, deleteGroup }) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const adding = input.trim().length > 0 && !orgs.some(g => g.name.toLowerCase() === input.trim().toLowerCase());

  const filtered = orgs.filter(g =>
    g.name.toLowerCase().includes(input.toLowerCase())
  ).slice(0, 30);

  const handleSelect = (name) => {
    onChange(name);
    setInput('');
    setFocused(false);
  };

  const handleClear = () => onChange('');

  const handleDelete = async (org, e) => {
    e.stopPropagation();
    if (!window.confirm(`Xoá tổ chức "${org.name}"?`)) return;
    try { if (deleteGroup) await deleteGroup(org.id); } catch {}
    if (value === org.name) onChange('');
  };

  const handleAddNew = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!orgs.some(g => g.name === trimmed) && addGroup) {
      try { await addGroup({ name: trimmed, color: '#6366F1' }); } catch {}
    }
    onChange(trimmed);
    setInput('');
    setFocused(false);
  };

  return (
    <div className="field-block">
      <div className="field-title">{label}</div>
      <div style={{ position: 'relative' }}>
        {value ? (
          <div className="chip active" style={{ width: '100%', justifyContent: 'space-between', boxSizing: 'border-box', minHeight: 32 }}>
            <span style={{ fontSize: 13 }}>{value}</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <X size={14} onClick={handleClear} style={{ cursor: 'pointer' }} title="Xoá lựa chọn" />
            </div>
          </div>
        ) : (
          <input className="field-input" placeholder="Gõ tên tổ chức..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            onKeyDown={e => {
              if (e.key === 'Enter' && adding) { e.preventDefault(); handleAddNew(); }
              else if (e.key === 'Enter' && filtered.length === 1) { handleSelect(filtered[0].name); }
            }} />
        )}
        {focused && !value && input.length >= 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4,
            background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            maxHeight: 220, overflowY: 'auto',
          }}>
            {filtered.map(g => (
              <div key={g.id}
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseDown={() => handleSelect(g.name)}
                onMouseEnter={e => e.currentTarget.style.background = '#F1F1F4'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <span>{g.name}</span>
                <X size={12} onMouseDown={e => handleDelete(g, e)}
                  style={{ color: '#E6002D', cursor: 'pointer', opacity: 0.6 }} title="Xoá tổ chức" />
              </div>
            ))}
            {adding && (
              <div style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#6366F1', fontWeight: 700, borderTop: '1px solid #F1F1F4' }}
                onMouseDown={handleAddNew}>
                + Thêm tổ chức "{input.trim()}"
              </div>
            )}
            {!input && filtered.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 13, color: '#9CA3AF' }}>Chưa có tổ chức nào</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function People({ people, tags, groups, onSelectPerson, addPerson, updatePerson, addGroup, updateGroup, deleteGroup }) {
  const { lang } = useApp();
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeOrg, setActiveOrg] = useState(null);
  const [activeScore, setActiveScore] = useState(null);
  const [activeGender, setActiveGender] = useState(null);
  const [activeBirthMonth, setActiveBirthMonth] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [form, setForm] = useState(getEmptyPerson());
  const [editingPerson, setEditingPerson] = useState(null);
  const [customGroupInput, setCustomGroupInput] = useState('');
  const [showGroupManager, setShowGroupManager] = useState(false);

  // Collect unique orgs from groups collection
  const orgs = useMemo(() => {
    return [...groups].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [groups]);

  // Filtered orgs for Tổ chức 1 & Tổ chức 2 (from predefined lists + current selection)
  const org1List = useMemo(() => {
    const current = form.organizations[0];
    return orgs.filter(g => ORG1_NAMES.has(g.name) || g.name === current);
  }, [orgs, form.organizations[0]]);

  const org2List = useMemo(() => {
    const current = form.organizations[1];
    return orgs.filter(g => ORG2_NAMES.has(g.name) || g.name === current);
  }, [orgs, form.organizations[1]]);

  const filtered = useMemo(() => {
    let list = [...people];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.note || p.notes || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    }
    if (activeGroup) {
      list = list.filter(p => p.relationship === activeGroup);
    }
    if (activeOrg) {
      list = list.filter(p => {
        const orgs = p.organizations || (p.organization ? [p.organization] : []);
        return orgs.includes(activeOrg);
      });
    }
    if (activeScore !== null) {
      list = list.filter(p => {
        const score = p.relationshipScore ?? 50;
        return score >= activeScore.range[0] && score <= activeScore.range[1];
      });
    }
    if (activeGender) {
      list = list.filter(p => (p.gender || 'male') === activeGender);
    }
    if (activeBirthMonth) {
      list = list.filter(p => {
        if (!p.dob) return false;
        const month = parseInt(p.dob.split('-')[1], 10);
        return month === activeBirthMonth;
      });
    }
    return list.sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0));
  }, [people, search, activeGroup, activeOrg, activeScore, activeGender, activeBirthMonth]);

  async function handleSubmit() {
    if (!form.name.trim()) return;
    const payload = { ...form };
    if (payload.relationship === '__custom__' && payload.customGroup) {
      payload.relationship = payload.customGroup;
    }
    delete payload.customGroup;
    payload.socialLinks = payload.socialLinks.filter(s => s.url.trim());
    // Handle organizations → groupIds mapping
    const orgs = payload.organizations || [];
    const gIds = [];
    for (const name of orgs) {
      const existingGroup = groups.find(g => g.name === name);
      if (existingGroup) {
        gIds.push(existingGroup.id);
      } else {
        const newGroup = await addGroup({ name, color: '#6366F1' });
        gIds.push(newGroup?.id || name);
      }
    }
    payload.organizations = orgs;
    payload.groupIds = gIds;
    // Keep single-org fields for backward compat
    payload.organization = orgs[0] || '';
    payload.groupId = gIds[0] || null;
    if (editingPerson) {
      updatePerson(editingPerson, payload);
    } else {
      addPerson(payload);
    }
    setForm(getEmptyPerson());
    setEditingPerson(null);
    setShowAdd(false);
    setCustomGroupInput('');
  }

  function handleEdit(person) {
    setEditingPerson(person.id);
    setForm(normalizePerson(person));
    setShowAdd(true);
  }

  function openAdd() {
    setEditingPerson(null);
    setForm(getEmptyPerson());
    setShowAdd(true);
    setCustomGroupInput('');
  }

  function toggleFormTag(tag) {
    setForm(prev => {
      const exists = prev.tags.find(t => t.id === tag.id);
      return {
        ...prev,
        tags: exists
          ? prev.tags.filter(t => t.id !== tag.id)
          : [...prev.tags, { id: tag.id, nameVI: tag.nameVI, nameEN: tag.nameEN, color: tag.color }],
      };
    });
  }

  function formatDobInput(e) {
    let v = e.target.value.replace(/[^0-9]/g, '');
    if (v.length >= 5 && v.length <= 6) {
      // dd/mm/yy -> try adding 20 prefix
    }
    if (v.length > 4) {
      v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4, 8);
    } else if (v.length > 2) {
      v = v.slice(0, 2) + '/' + v.slice(2);
    }
    setForm(p => ({ ...p, dob: v }));
  }

  return (
    <div style={{ padding: 'var(--space-page-x)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{t('people.title', lang)}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>{people.length} {t('dashboard.totalPeople', lang)}</div>
        </div>
        <button
          onClick={openAdd}
          style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--grad-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(230,0,45,0.3)' }}
        >
          <Plus size={24} color="white" />
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 14, top: 14 }} />
        <input
          className="input-pill"
          style={{ paddingLeft: 40 }}
          placeholder={t('people.searchPeople', lang)}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <X size={18} color="#9CA3AF" style={{ position: 'absolute', right: 14, top: 14, cursor: 'pointer' }} onClick={() => setSearch('')} />
        )}
      </div>

      {/* Filters toolbar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', background: '#F1F1F4', borderRadius: 10, padding: 2, flexShrink: 0 }}>
          <div className={`chip ${viewMode === 'card' ? 'active' : ''}`}
            style={{ padding: '6px 10px', cursor: 'pointer' }}
            onClick={() => setViewMode('card')}>
            <Users size={14} />
          </div>
          <div className={`chip ${viewMode === 'table' ? 'active' : ''}`}
            style={{ padding: '6px 10px', cursor: 'pointer' }}
            onClick={() => setViewMode('table')}>
            <List size={14} />
          </div>
        </div>

        {/* Filter toggle button */}
        <div className={`chip ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          🧹 {t('common.filters', lang) || 'Lọc'}
          {[activeGroup, activeOrg, activeScore, activeGender, activeBirthMonth].filter(Boolean).length > 0 && (
            <span style={{ marginLeft: 6, background: '#E6002D', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
              {[activeGroup, activeOrg, activeScore, activeGender, activeBirthMonth].filter(Boolean).length}
            </span>
          )}
        </div>

        {/* Group manager button */}
        <div className="chip"
          onClick={() => setShowGroupManager(true)}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          <SlidersHorizontal size={14} /> Quản lý tổ chức
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Row 1: Relationship groups */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 6 }}>Nhóm quan hệ</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <div className={`chip ${activeGroup === null ? 'active' : ''}`}
                  style={{ fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
                  onClick={() => setActiveGroup(null)}>{t('people.allTags', lang)}</div>
                {RELATIONSHIP_GROUPS.map(g => (
                  <div key={g} className={`chip ${activeGroup === g ? 'active' : ''}`}
                    style={{ fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
                    onClick={() => setActiveGroup(activeGroup === g ? null : g)}>{g}</div>
                ))}
              </div>
            </div>
            {/* Row 2: Dropdown filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Tổ chức</div>
                <select className="input-pill" style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                  value={activeOrg || ''}
                  onChange={e => setActiveOrg(e.target.value || null)}>
                  <option value="">Tất cả</option>
                  {orgs.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Giới tính</div>
                <select className="input-pill" style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                  value={activeGender || ''}
                  onChange={e => setActiveGender(e.target.value || null)}>
                  <option value="">Tất cả</option>
                  <option value="male">Nam ♂</option>
                  <option value="female">Nữ ♀</option>
                  <option value="other">Khác ⚧</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Sinh tháng</div>
                <select className="input-pill" style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                  value={activeBirthMonth || ''}
                  onChange={e => setActiveBirthMonth(e.target.value ? parseInt(e.target.value) : null)}>
                  <option value="">Tất cả</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Điểm</div>
                <select className="input-pill" style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                  value={activeScore ? activeScore.key : ''}
                  onChange={e => {
                    const found = SCORE_LEVELS.find(l => l.key === e.target.value);
                    setActiveScore(found || null);
                  }}>
                  <option value="">Tất cả</option>
                  {SCORE_LEVELS.map(l => (
                    <option key={l.key} value={l.key}>{l.emoji} {l.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Clear all */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className="chip" style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer', color: '#E6002D' }}
                onClick={() => { setActiveGroup(null); setActiveOrg(null); setActiveScore(null); setActiveGender(null); setActiveBirthMonth(null); }}>
                Xoá tất cả bộ lọc
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TABLE VIEW ─── */}
      {viewMode === 'table' && (
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F1F1F4' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>{t('people.name', lang)}</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Giới tính</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Điện thoại</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Ngày sinh</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Email</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Tổ chức</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Nhóm</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Trạng thái</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Nguồn</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}
                  onClick={() => onSelectPerson(p.id)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                    {p.isFavorite && <span style={{ marginRight: 4 }}>🌟</span>}{p.name}
                  </td>
                  <td style={{ padding: '8px 10px' }}>{p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : 'Khác'}</td>
                  <td style={{ padding: '8px 10px' }}>{Array.isArray(p.phones) ? p.phones.join(', ') : p.phone || ''}</td>
                  <td style={{ padding: '8px 10px' }}>{p.dob ? formatDate(p.dob) : ''}</td>
                  <td style={{ padding: '8px 10px' }}>{Array.isArray(p.emails) ? p.emails[0] || '' : p.email || ''}</td>
                  <td style={{ padding: '8px 10px' }}>{p.organization || ''}</td>
                  <td style={{ padding: '8px 10px' }}>{p.relationship || (p.tags || []).map(t => t.nameVI || t.nameEN).join(', ')}</td>
                  <td style={{ padding: '8px 10px' }}>{p.status || ''}</td>
                  <td style={{ padding: '8px 10px' }}>{p.source || ''}</td>
                  <td style={{ padding: '8px 10px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── EMPTY STATE ─── */}
      {filtered.length === 0 && viewMode === 'card' ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Users size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9CA3AF' }}>{t('people.noPeople', lang)}</div>
        </div>
      ) : null}

      {/* ─── CARD VIEW ─── */}
      {viewMode === 'card' && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => {
            const s = getScoreInfo(p.relationshipScore || 0);
            const pGroups = p.tags || [];
            const displayPhone = Array.isArray(p.phones) ? p.phones[0] || '' : p.phone || '';
            return (
              <div
                key={p.id}
                className="card"
                onClick={() => onSelectPerson(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
              >
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: 'var(--grad-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontWeight: 800, color: 'white', flexShrink: 0,
                }}>
                  {(p.name || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="card-safe" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {p.isFavorite && <span style={{ fontSize: 12, flexShrink: 0 }}>🌟</span>}
                    <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{p.name}</span>
                    {p.relationship && <span className="chip-tag" style={{ background: '#6366F1', fontSize: 8, padding: '1px 5px', flexShrink: 0 }}>{p.relationship}</span>}
                    {p.status && p.status !== 'Active' && (
                      <span className="chip-tag" style={{
                        background: p.status === 'Deceased' ? '#374151' : p.status === 'Lost Contact' ? '#F59E0B' : p.status === 'Blocked' ? '#E6002D' : '#6366F1',
                        fontSize: 8, padding: '1px 5px', flexShrink: 0
                      }}>{p.status}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    {p.gender && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '⚧'}</span>}
                    {displayPhone && <span className="truncate" style={{ fontSize: 10, color: '#9CA3AF', maxWidth: 120 }}>📞 {displayPhone}</span>}
                    {(p.organizations || (p.organization ? [p.organization] : [])).slice(0, 2).map(org => (
                      <span key={org} className="chip-tag" style={{ background: '#6366F1', fontSize: 8, padding: '1px 5px' }}>
                        {org}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 32 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color || '#E6002D' }}>{s.emoji}</div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>{p.relationshipScore || 0}</div>
                </div>

                {/* Edit button */}
                <div onClick={e => { e.stopPropagation(); handleEdit(p); }}
                  style={{ fontSize: 10, color: '#6B7280', cursor: 'pointer', flexShrink: 0, padding: 2 }}>
                  ✏️
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ADD/EDIT MODAL ─── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setEditingPerson(null); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
              {editingPerson ? t('people.editPerson', lang) : t('people.addPerson', lang)}
            </div>

            <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* ── THÔNG TIN CƠ BẢN ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Thông tin cơ bản</div>

              {/* Họ tên */}
              <div className="field-block">
                <div className="field-title">Họ tên</div>
                <input className="field-input" placeholder={t('people.name', lang)}
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>

              {/* Giới tính + Ngày sinh — side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-block" style={{ padding: '12px 14px' }}>
                  <div className="field-title">Giới tính</div>
                  <select className="field-input" value={form.gender}
                    onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div className="field-block" style={{ padding: '12px 14px' }}>
                  <div className="field-title">Ngày sinh</div>
                  <input className="field-input" placeholder="dd/mm/yyyy" value={form.dob}
                    onChange={formatDobInput} maxLength={10} />
                </div>
              </div>

              {/* ── THÔNG TIN LIÊN HỆ ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Thông tin liên hệ</div>

              {/* Số điện thoại + Email — side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field-block" style={{ padding: '12px 14px' }}>
                  <div className="field-title">Số điện thoại</div>
                  <MultiInput values={form.phones} onChange={v => setForm(p => ({ ...p, phones: v }))} placeholder="Thêm số điện thoại..." />
                </div>
                <div className="field-block" style={{ padding: '12px 14px' }}>
                  <div className="field-title">Email</div>
                  <MultiInput values={form.emails} onChange={v => setForm(p => ({ ...p, emails: v }))} placeholder="Thêm email..." />
                </div>
              </div>

              {/* Địa chỉ */}
              <div className="field-block">
                <div className="field-title">Địa chỉ</div>
                <input className="field-input" placeholder={t('people.address', lang)}
                  value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>

              {/* Link mạng xã hội */}
              <div className="field-block">
                <div className="field-title">Link mạng xã hội</div>
                <SocialLinksInput links={form.socialLinks}
                  onChange={v => setForm(p => ({ ...p, socialLinks: v }))} />
              </div>

              {/* ── PHÂN LOẠI ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Phân loại</div>

              {/* Mối quan hệ — tag chips */}
              <div className="field-block">
                <div className="field-title">Mối quan hệ</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {RELATIONSHIP_GROUPS.map(g => {
                    const sel = form.relationship === g;
                    return (
                      <div key={g}
                        className={`chip ${sel ? 'active' : ''}`}
                        style={{ flex: '0 0 auto', cursor: 'pointer' }}
                        onClick={() => setForm(p => ({ ...p, relationship: sel ? '' : g }))}>
                        {g}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tổ chức 1 */}
              <SingleOrgSelector
                label="Tổ chức 1"
                orgs={org1List}
                value={form.organizations[0] || ''}
                onChange={v => {
                  const arr = [...form.organizations];
                  arr[0] = v;
                  if (v && !arr[1]) arr[1] = '';
                  setForm(p => ({ ...p, organizations: arr }));
                }}
                addGroup={addGroup}
                deleteGroup={deleteGroup}
              />

              {/* Tổ chức 2 */}
              <SingleOrgSelector
                label="Tổ chức 2"
                orgs={org2List}
                value={form.organizations[1] || ''}
                onChange={v => {
                  const arr = [...form.organizations];
                  arr[1] = v;
                  setForm(p => ({ ...p, organizations: arr }));
                }}
                addGroup={addGroup}
                deleteGroup={deleteGroup}
              />

              {/* ── THIẾT LẬP THÊM ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Thiết lập thêm</div>

              {/* Điểm thân thiết */}
              <div className="field-block">
                <div className="field-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Điểm thân thiết</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#E6002D' }}>{form.relationshipScore}</span>
                </div>
                <ScoreSelector value={form.relationshipScore}
                  onChange={v => setForm(p => ({ ...p, relationshipScore: v }))} />
              </div>

              {/* Trạng thái */}
              <div className="field-block">
                <div className="field-title">Trạng thái</div>
                <select className="field-input" value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Lost Contact">Lost Contact</option>
                  <option value="Deceased">Deceased</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>

              {/* Yêu thích */}
              <div className="field-block">
                <div className="field-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                  <span>Yêu thích</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', userSelect: 'none' }}>
                      {form.isFavorite ? 'Đã yêu thích' : 'Chưa yêu thích'}
                    </span>
                    <input type="checkbox" checked={form.isFavorite}
                      onChange={e => setForm(p => ({ ...p, isFavorite: e.target.checked }))}
                      style={{ width: 20, height: 20, accentColor: '#E6002D', cursor: 'pointer' }} />
                  </label>
                </div>
              </div>

              {/* Ghi chú */}
              <div className="field-block">
                <div className="field-title">Ghi chú</div>
                <textarea className="field-input" placeholder={t('people.notes', lang)}
                  value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  style={{ minHeight: 70, resize: 'vertical' }} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }}
                  onClick={() => { setShowAdd(false); setEditingPerson(null); }}>
                  {t('common.cancel', lang)}
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }}
                  disabled={!form.name.trim()}>
                  {editingPerson ? 'Cập nhật' : t('people.save', lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Manager Modal */}
      {showGroupManager && <GroupManager groups={groups} addGroup={addGroup} updateGroup={updateGroup} deleteGroup={deleteGroup} onClose={() => setShowGroupManager(false)} />}

      <div style={{ height: 20 }} />
    </div>
  );
}

// ─── Tag Manager Component (unchanged) ───
function TagManager({ tags, lang, onClose }) {
  const { addTag, updateTag, deleteTag } = useApp();
  const [newTag, setNewTag] = useState({ nameVI: '', nameEN: '', color: '#6366F1' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  function handleAdd() {
    if (!newTag.nameVI.trim()) return;
    addTag({ ...newTag, icon: 'tag' });
    setNewTag({ nameVI: '', nameEN: '', color: '#6366F1' });
  }

  function startEdit(tag) {
    setEditingId(tag.id);
    setEditForm({ nameVI: tag.nameVI, nameEN: tag.nameEN, color: tag.color });
  }

  function saveEdit(id) {
    updateTag(id, editForm);
    setEditingId(null);
  }

  const colors = ['#E6002D', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#6B7280'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{t('people.manageTags', lang)}</div>

        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tags.map(tag => (
            <div key={tag.id} className="card" style={{ padding: '12px 14px' }}>
              {editingId === tag.id ? (
                <div>
                  <input className="input-pill" style={{ marginBottom: 8 }} value={editForm.nameVI}
                    onChange={e => setEditForm(p => ({ ...p, nameVI: e.target.value }))} placeholder={t('people.tagNameVi', lang)} />
                  <input className="input-pill" style={{ marginBottom: 8 }} value={editForm.nameEN}
                    onChange={e => setEditForm(p => ({ ...p, nameEN: e.target.value }))} placeholder={t('people.tagNameEn', lang)} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {colors.map(c => (
                      <div key={c} onClick={() => setEditForm(p => ({ ...p, color: c }))}
                        style={{ width: 24, height: 24, borderRadius: 12, background: c, cursor: 'pointer', border: editForm.color === c ? '2px solid #101010' : '2px solid transparent' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" style={{ flex: 1, padding: 8 }} onClick={() => setEditingId(null)}>{t('common.cancel', lang)}</button>
                    <button className="btn-primary" style={{ flex: 1, padding: 8 }} onClick={() => saveEdit(tag.id)}>{t('common.save', lang)}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 6, background: tag.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{tag.nameVI}</span>
                    <span style={{ color: '#9CA3AF', fontSize: 12, marginLeft: 6 }}>{tag.nameEN}</span>
                  </div>
                  <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => startEdit(tag)}>{t('common.edit', lang)}</button>
                  <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 12, color: '#E6002D' }} onClick={() => deleteTag(tag.id)}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('people.addTag', lang)}</div>
          <input className="input-pill" style={{ marginBottom: 8 }} value={newTag.nameVI}
            onChange={e => setNewTag(p => ({ ...p, nameVI: e.target.value }))} placeholder={t('people.tagNameVi', lang)} />
          <input className="input-pill" style={{ marginBottom: 8 }} value={newTag.nameEN}
            onChange={e => setNewTag(p => ({ ...p, nameEN: e.target.value }))} placeholder={t('people.tagNameEn', lang)} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {colors.map(c => (
              <div key={c} onClick={() => setNewTag(p => ({ ...p, color: c }))}
                style={{ width: 24, height: 24, borderRadius: 12, background: c, cursor: 'pointer', border: newTag.color === c ? '2px solid #101010' : '2px solid transparent' }} />
            ))}
          </div>
          <button className="btn-primary" style={{ padding: 12 }} onClick={handleAdd} disabled={!newTag.nameVI.trim()}>
            + {t('people.addTag', lang)}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button className="btn-secondary" onClick={onClose}>{t('common.close', lang)}</button>
        </div>
      </div>
    </div>
  );
}
