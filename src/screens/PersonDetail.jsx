import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import {
  ArrowLeft, Trash2, Phone, MapPin, MessageCircle, Heart,
  CalendarDays, BookHeart, Edit3, Plus, Mail, Globe, Tag, Users, X
} from 'lucide-react';
import { t, formatDate, formatDateInput } from '../i18n';
import GroupSelector from '../components/GroupSelector';
import { getScoreInfo } from '../contexts/AppContext';

const SOCIAL_PLATFORMS = ['facebook', 'zalo', 'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'other'];
const RELATIONSHIP_GROUPS = [
  'Gia đình ruột', 'Họ hàng', 'Giáo viên chủ nhiệm', 'Bạn thân',
  'Bạn cấp 1', 'Bạn cấp 2', 'Bạn cấp 3', 'Bạn đại học',
  'Bạn cao học', 'Bạn bang hội', 'Bạn du lịch', 'Bạn tìm hiểu',
  'Bạn xã hội', 'Đồng nghiệp cũ', 'Đồng nghiệp mới', 'Khác',
].sort((a, b) => a.localeCompare(b, 'vi'));

const SCORE_LEVELS = [
  { range: [1, 29], key: 'scoreAcquainted', label: 'Quen biết', emoji: '⚪' },
  { range: [30, 49], key: 'scoreFriendly', label: 'Bạn bè', emoji: '🟢' },
  { range: [50, 69], key: 'scoreCloseFriend', label: 'Thân', emoji: '🔵' },
  { range: [70, 89], key: 'scoreIntimate', label: 'Thân thiết', emoji: '🟣' },
  { range: [90, 100], key: 'scoreSoulmate', label: 'Ruột thịt', emoji: '❤️' },
];
const DEFAULT_SOCIAL = { platform: 'facebook', url: '' };

function normalizePerson(p) {
  return {
    name: p.name || '', gender: p.gender || 'male', dob: p.dob || '',
    phones: Array.isArray(p.phones) ? [...p.phones] : (p.phone ? [p.phone] : []),
    emails: Array.isArray(p.emails) ? [...p.emails] : (p.email ? [p.email] : []),
    address: p.address || '',
    socialLinks: Array.isArray(p.socialLinks) ? p.socialLinks.map(s => ({ platform: s.platform || 'facebook', url: s.url || '' }))
      : [{ ...DEFAULT_SOCIAL }],
    relationship: p.relationship || '',
    organization: p.organization || '',
    organizations: Array.isArray(p.organizations) ? [...p.organizations] : (p.organization ? [p.organization] : []),
    groupIds: Array.isArray(p.groupIds) ? [...p.groupIds] : (p.groupId ? [p.groupId] : []),
    relationshipScore: p.relationshipScore ?? 50,
    notes: p.notes || '',
    tags: p.tags || [],
    customGroup: '',
  };
}

// ─── Mini Multi-input (same as People.jsx) ───
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
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="input-pill" style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder} />
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
          onClick={add} type="button">+</button>
      </div>
    </div>
  );
}

// ─── Mini Social Links ───
function SocialLinksInput({ links, onChange }) {
  const addLink = () => onChange([...links, { platform: 'facebook', url: '' }]);
  const removeLink = (i) => onChange(links.filter((_, j) => j !== i));
  const updateLink = (i, field, value) => {
    onChange(links.map((l, j) => j === i ? { ...l, [field]: value } : l));
  };
  return (
    <div>
      {links.map((link, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
          <select className="input-pill" style={{ width: 100, fontSize: 12, padding: '8px 6px' }}
            value={link.platform} onChange={e => updateLink(i, 'platform', e.target.value)}>
            {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <input className="input-pill" style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
            value={link.url} onChange={e => updateLink(i, 'url', e.target.value)}
            placeholder="URL..." />
          {links.length > 1 && (
            <X size={16} style={{ cursor: 'pointer', color: '#E6002D', flexShrink: 0 }} onClick={() => removeLink(i)} />
          )}
        </div>
      ))}
      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, marginTop: 2 }}
        onClick={addLink} type="button">+ Thêm</button>
    </div>
  );
}

// ─── Mini Score Selector + Slider ───
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
              style={{ flex: '1 0 auto', justifyContent: 'center', minWidth: 50, ...(sel ? {} : { opacity: 0.7 }) }}>
              {lv.emoji} {lv.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PersonDetail({ person, events, memories, onBack, onDelete, onAddInteraction, groups, addGroup }) {
  const { lang, updatePerson } = useApp();
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(normalizePerson(person));
  const [showInteraction, setShowInteraction] = useState(false);
  const [interactionText, setInteractionText] = useState('');
  const [interactionType, setInteractionType] = useState('meet');

  const s = getScoreInfo(person.relationshipScore || 0);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const lastContact = person.lastInteractionDate ? daysBetween(person.lastInteractionDate, today) : null;

  const interactionTypes = [
    { id: 'meet', label: 'Gặp mặt' },
    { id: 'call', label: 'Gọi điện' },
    { id: 'message', label: 'Nhắn tin' },
  ];

  const handleAddInteraction = () => {
    onAddInteraction({ type: interactionType, notes: interactionText });
    setInteractionText('');
    setShowInteraction(false);
  };

  const handleSaveEdit = () => {
    const payload = { ...editForm };
    delete payload.customGroup;
    payload.socialLinks = payload.socialLinks.filter(s => s.url.trim());
    // Handle organizations → groupIds mapping
    const orgs = payload.organizations || [];
    const gIds = [];
    orgs.forEach(name => {
      const existingGroup = groups.find(g => g.name === name);
      if (existingGroup) {
        gIds.push(existingGroup.id);
      } else {
        const newGroup = addGroup({ name, color: '#6366F1' });
        gIds.push(newGroup.id);
      }
    });
    payload.organizations = orgs;
    payload.groupIds = gIds;
    // Keep single-org fields for backward compat
    payload.organization = orgs[0] || '';
    payload.groupId = gIds[0] || null;
    updatePerson(person.id, payload);
    setShowEdit(false);
  };

  // Birthday: display dd/mm only, edit shows dd/mm/yyyy
  const displayDob = person.dob ? (() => {
    const parts = person.dob.split('/');
    if (parts.length === 3) return `${parts[0]}/${parts[1]}`; // dd/mm only
    // Try YYYY-MM-DD
    const d = person.dob.split('-');
    if (d.length === 3) return `${d[2]}/${d[1]}`;
    return person.dob;
  })() : null;

  // Build fields list
  const displayPhones = Array.isArray(person.phones) ? person.phones : (person.phone ? [person.phone] : []);
  const displayEmails = Array.isArray(person.emails) ? person.emails : (person.email ? [person.email] : []);
  const displaySocials = Array.isArray(person.socialLinks) ? person.socialLinks :
    [['facebook', person.facebook], ['tiktok', person.tiktok]].filter(([_, v]) => v).map(([p, v]) => ({ platform: p, url: v }));

  const fields = [
    ...displayPhones.map(ph => ({ icon: Phone, label: ph })),
    ...displayEmails.map(em => ({ icon: Mail, label: em })),
    ...displaySocials.map(sl => ({ icon: Globe, label: `${sl.platform}: ${sl.url}` })),
    { icon: MapPin, label: person.address || '—' },
  ].filter(f => f.label && f.label !== '—');

  return (
    <div style={{ padding: 'var(--space-page-x)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 8 }}>
        <div onClick={onBack} style={{ width: 40, height: 40, borderRadius: 20, background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={20} />
        </div>
        <div style={{ flex: 1 }} />
        <div onClick={() => setShowEdit(true)} style={{ width: 40, height: 40, borderRadius: 20, background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Edit3 size={18} color="#6B7280" />
        </div>
        <div onClick={onDelete} style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(230,0,45,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Trash2 size={18} color="#E6002D" />
        </div>
      </div>

      {/* Avatar + Name + Info */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'var(--grad-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 800, color: 'white', margin: '0 auto 12px',
        }}>
          {(person.name || '?')[0].toUpperCase()}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{person.name}</div>
        {/* Gender badge */}
        <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
          {person.gender === 'male' ? '♂ Nam' : person.gender === 'female' ? '♀ Nữ' : '⚧ Khác'}
        </div>
        {/* Status & Favorite badges */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6 }}>
          {person.isFavorite && <span className="chip-tag" style={{ background: '#F59E0B' }}>🌟 Yêu thích</span>}
          {person.status && person.status !== 'Active' && (
            <span className="chip-tag" style={{
              background: person.status === 'Deceased' ? '#374151' : person.status === 'Lost Contact' ? '#F59E0B' : person.status === 'Blocked' ? '#E6002D' : '#6366F1'
            }}>{person.status}</span>
          )}
        </div>
      </div>

      {/* Relationship + Organizations badges */}
      {(person.relationship || (person.organizations || (person.organization ? [person.organization] : [])).filter(Boolean).length > 0) && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {person.relationship && (
            <span className="chip-tag" style={{ background: '#6366F1' }}>
              <Users size={12} /> {person.relationship}
            </span>
          )}
          {(person.organizations || (person.organization ? [person.organization] : [])).filter(Boolean).map((org, i) => (
            <span key={i} className="chip-tag" style={{ background: '#10B981' }}>
              <Tag size={12} /> {org}
            </span>
          ))}
        </div>
      )}

      {/* Relationship Score */}
      <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 36, lineHeight: 1 }}>{s.emoji}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: s.color || '#E6002D', marginTop: 4 }}>
          {t('people.' + s.key, lang) || s.key}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
          {person.relationshipScore || 0} điểm
        </div>
        <div className="score-bar" style={{ marginTop: 12, maxWidth: 200, margin: '12px auto 0' }}>
          <div className="score-bar-fill" style={{ width: `${person.relationshipScore || 0}%`, background: s.color || 'var(--grad-primary)' }} />
        </div>
      </div>

      {/* Birthday card — chỉ hiện dd/mm */}
      {displayDob && (
        <div className="card" style={{ marginBottom: 16, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>
            <CalendarDays size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Sinh nhật
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#E6002D', letterSpacing: 2 }}>
            {displayDob}
          </div>
        </div>
      )}

      {/* Last contact */}
      {lastContact !== null && (
        <div className="card" style={{ marginBottom: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Heart size={20} color={lastContact > 30 ? '#F59E0B' : '#10B981'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t('people.lastInteraction', lang)}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>
              {lastContact === 0 ? t('score.today', lang) :
               lastContact === 1 ? t('score.yesterday', lang) :
               t('score.daysAgo', lang, { days: lastContact })}
            </div>
          </div>
          <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => setShowInteraction(true)}>
            <Plus size={14} /> {t('people.addInteraction', lang)}
          </button>
        </div>
      )}

      {/* Contact Info */}
      {fields.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📋 Liên hệ</div>
          {fields.map((f, i) => (
            <div key={i} className="action-field" style={{ padding: '8px 0' }}>
              <div className="af-label"><f.icon size={16} color="#9CA3AF" />{f.label}</div>
            </div>
          ))}
          {person.notes && (
            <div style={{ padding: '8px 0', fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}>
              "{person.notes}"
            </div>
          )}
        </div>
      )}

      {/* Shared Events */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🎪 {t('people.commonEvents', lang)} ({events.length})</div>
        {events.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9CA3AF', padding: '8px 0' }}>{t('events.noEvents', lang)}</div>
        ) : (
          events.slice(0, 5).map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎪</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{e.date ? formatDate(e.date) : ''}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Shared Memories */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>💭 {t('people.commonMemories', lang)} ({memories.length})</div>
        {memories.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9CA3AF', padding: '8px 0' }}>{t('memories.noMemories', lang)}</div>
        ) : (
          memories.slice(0, 5).map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💭</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{m.mood} · {m.date ? formatDate(m.date) : ''}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Interaction Modal */}
      {showInteraction && (
        <div className="modal-overlay" onClick={() => setShowInteraction(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{t('people.addInteraction', lang)}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {interactionTypes.map(t => (
                <button key={t.id} className={`chip ${interactionType === t.id ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setInteractionType(t.id)}>{t.label}</button>
              ))}
            </div>
            <input className="input-pill" placeholder={t('people.notes', lang)} value={interactionText}
              onChange={e => setInteractionText(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowInteraction(false)}>{t('common.cancel', lang)}</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleAddInteraction}>{t('common.save', lang)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-handle" />
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{t('people.editPerson', lang)}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* ── THÔNG TIN CƠ BẢN ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Thông tin cơ bản</div>
              {/* Tên */}
              <input className="input-pill" placeholder={t('people.name', lang)}
                value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />

              {/* Giới tính + Ngày sinh */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select className="input-pill" value={editForm.gender}
                  onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))}>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
                <input className="input-pill" placeholder="dd/mm/yyyy" value={editForm.dob || ''}
                  onChange={e => {
                    let v = e.target.value.replace(/[^0-9]/g, '');
                    if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4, 8);
                    else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                    setEditForm(p => ({ ...p, dob: v }));
                  }} maxLength={10} />
              </div>

              {/* ── THÔNG TIN LIÊN HỆ ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Thông tin liên hệ</div>
              {/* Số điện thoại */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Số điện thoại</div>
                <MultiInput values={editForm.phones} onChange={v => setEditForm(p => ({ ...p, phones: v }))} placeholder="Thêm số..." />
              </div>
              {/* Email */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Email</div>
                <MultiInput values={editForm.emails} onChange={v => setEditForm(p => ({ ...p, emails: v }))} placeholder="Thêm email..." />
              </div>
              {/* Địa chỉ */}
              <input className="input-pill" placeholder={t('people.address', lang)}
                value={editForm.address || ''} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
              {/* Mạng xã hội */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Mạng xã hội</div>
                <SocialLinksInput links={editForm.socialLinks} onChange={v => setEditForm(p => ({ ...p, socialLinks: v }))} />
              </div>

              {/* ── PHÂN LOẠI ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Phân loại</div>
              {/* Nhóm */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Nhóm</div>
                <select className="input-pill" value={editForm.relationship}
                  onChange={e => setEditForm(p => ({ ...p, relationship: e.target.value, customGroup: '' }))}>
                  <option value="">-- Chọn nhóm --</option>
                  {RELATIONSHIP_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="__custom__">+ Thêm nhóm mới...</option>
                </select>
                {editForm.relationship === '__custom__' && (
                  <input className="input-pill" style={{ marginTop: 6 }}
                    placeholder="Nhập tên nhóm..."
                    value={editForm.customGroup}
                    onChange={e => setEditForm(p => ({ ...p, customGroup: e.target.value }))} />
                )}
              </div>
              {/* Tổ chức */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Tổ chức</div>
                <GroupSelector
                  groups={groups}
                  values={editForm.organizations || []}
                  onChange={v => setEditForm(p => ({ ...p, organizations: v }))}
                  addGroup={addGroup}
                />
              </div>

              {/* ── THIẾT LẬP THÊM ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Thiết lập thêm</div>
              {/* Điểm thân thiết */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>Điểm thân thiết</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#E6002D' }}>{editForm.relationshipScore}</div>
                </div>
                <ScoreSelector value={editForm.relationshipScore}
                  onChange={v => setEditForm(p => ({ ...p, relationshipScore: v }))} />
              </div>
              {/* Trạng thái */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Trạng thái</div>
                <select className="input-pill" value={editForm.status}
                  onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Lost Contact">Lost Contact</option>
                  <option value="Deceased">Deceased</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
              {/* Yêu thích */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="editFavToggle" checked={editForm.isFavorite}
                  onChange={e => setEditForm(p => ({ ...p, isFavorite: e.target.checked }))}
                  style={{ width: 20, height: 20, accentColor: '#E6002D' }} />
                <label htmlFor="editFavToggle" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Yêu thích 🌟
                </label>
              </div>
              {/* Nguồn */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>Nguồn dữ liệu</div>
                <input className="input-pill" placeholder="VD: Excel Import, Manual..."
                  value={editForm.source || ''} onChange={e => setEditForm(p => ({ ...p, source: e.target.value }))} />
              </div>
              {/* Ghi chú */}
              <textarea className="input-pill" placeholder={t('people.notes', lang)}
                value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                style={{ minHeight: 60, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowEdit(false)}>{t('common.cancel', lang)}</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleSaveEdit}>Cập nhật</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
