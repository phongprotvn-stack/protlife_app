import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { Plus, Search, X, BookHeart, Heart } from 'lucide-react';
import { t, formatDate, getMoodColor } from '../i18n';

const MOODS = ['happy', 'excited', 'peaceful', 'nostalgic', 'grateful', 'inspired', 'sad', 'loved'];

const MOOD_EMOJIS = {
  happy: '😊', excited: '🤩', peaceful: '😌', nostalgic: '🥹',
  grateful: '🙏', inspired: '✨', sad: '😢', loved: '🥰',
};

export default function Memories({ memories, people, places, addMemory, updateMemory, deleteMemory }) {
  const { lang } = useApp();
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return { title: '', content: '', date: '', mood: '', peopleIds: [], placeId: '', photos: [] };
  }

  const filtered = useMemo(() => {
    let list = [...memories];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m => m.title?.toLowerCase().includes(q) || m.content?.toLowerCase().includes(q));
    }
    if (moodFilter) list = list.filter(m => m.mood === moodFilter);
    return list.sort((a, b) => ((b.date || b.createdAt || '') > (a.date || a.createdAt || '') ? 1 : -1));
  }, [memories, search, moodFilter]);

  const moodStats = useMemo(() => {
    const stats = {};
    for (const m of memories) {
      stats[m.mood] = (stats[m.mood] || 0) + 1;
    }
    return stats;
  }, [memories]);

  return (
    <div style={{ padding: 'var(--space-page-x)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{t('memories.title', lang)}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>{memories.length} {t('dashboard.totalMemories', lang)}</div>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--grad-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(230,0,45,0.3)' }}>
          <Plus size={24} color="white" />
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 14, top: 14 }} />
        <input className="input-pill" style={{ paddingLeft: 40 }} placeholder={t('memories.searchMemories', lang)} value={search} onChange={e => setSearch(e.target.value)} />
        {search && <X size={18} color="#9CA3AF" style={{ position: 'absolute', right: 14, top: 14, cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>

      {/* Mood filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        <div className={`chip ${!moodFilter ? 'active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setMoodFilter(null)}>
          {t('memories.allMoods', lang)}
        </div>
        {MOODS.map(mood => (
          <div key={mood} className={`chip ${moodFilter === mood ? 'active' : ''}`}
            style={{
              whiteSpace: 'nowrap', flexShrink: 0,
              background: moodFilter === mood ? getMoodColor(mood) : '#F1F1F4',
              color: moodFilter === mood ? 'white' : undefined,
            }}
            onClick={() => setMoodFilter(moodFilter === mood ? null : mood)}>
            {MOOD_EMOJIS[mood] || '💭'} {t(`memories.mood${mood.charAt(0).toUpperCase() + mood.slice(1)}`, lang)}
            {moodStats[mood] ? ` (${moodStats[mood]})` : ''}
          </div>
        ))}
      </div>

      {/* Memories list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <BookHeart size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9CA3AF' }}>{t('memories.noMemories', lang)}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(m => {
            const memoryPeople = (m.peopleIds || []).map(pid => people.find(p => p.id === pid)).filter(Boolean);
            const memoryPlace = m.placeId ? places.find(p => p.id === m.placeId) : null;
            const moodColor = getMoodColor(m.mood);

            return (
              <div key={m.id} className="card" style={{
                padding: '14px 16px',
                borderLeft: `4px solid ${moodColor}`,
                cursor: 'pointer',
                position: 'relative',
              }}
                onClick={() => {
                  if (confirm(lang === 'vi' ? 'Xoá ký ức này?' : 'Delete this memory?')) {
                    deleteMemory(m.id);
                  }
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{MOOD_EMOJIS[m.mood] || '💭'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{m.title}</div>
                    {m.date && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatDate(m.date)}</div>}
                    {m.content && (
                      <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {m.content}
                      </div>
                    )}
                    {memoryPeople.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {memoryPeople.slice(0, 3).map(p => (
                          <span key={p.id} style={{ fontSize: 11, background: '#F1F1F4', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            {p.name}
                          </span>
                        ))}
                        {memoryPeople.length > 3 && <span style={{ fontSize: 11, color: '#9CA3AF' }}>+{memoryPeople.length - 3}</span>}
                      </div>
                    )}
                    {memoryPlace && (
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>📍 {memoryPlace.name}</div>
                    )}
                    {/* Mood tag */}
                    <div style={{
                      display: 'inline-block', marginTop: 8,
                      fontSize: 10, fontWeight: 700, color: moodColor,
                      background: `${moodColor}15`,
                      padding: '2px 10px', borderRadius: 10,
                    }}>
                      {MOOD_EMOJIS[m.mood]} {t(`memories.mood${m.mood.charAt(0).toUpperCase() + m.mood.slice(1)}`, lang)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Memory Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{t('memories.addMemory', lang)}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input-pill" placeholder={t('memories.titleLabel', lang)} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              <input className="input-pill" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              
              <textarea className="input-pill" placeholder={t('memories.content', lang)} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                style={{ minHeight: 80, resize: 'vertical' }} />

              {/* Mood selector */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>{t('memories.mood', lang)}</div>
                <div className="mood-grid">
                  {MOODS.map(mood => (
                    <button key={mood}
                      className={`mood-btn ${form.mood === mood ? 'active' : ''}`}
                      style={form.mood === mood ? { background: getMoodColor(mood), color: 'white' } : {}}
                      onClick={() => setForm(p => ({ ...p, mood }))}>
                      {MOOD_EMOJIS[mood]} {t(`memories.mood${mood.charAt(0).toUpperCase() + mood.slice(1)}`, lang)}
                    </button>
                  ))}
                </div>
              </div>

              {/* People selector */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>{t('memories.people', lang)}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {people.map(p => {
                    const selected = form.peopleIds.includes(p.id);
                    return (
                      <div key={p.id} className={`chip ${selected ? 'active' : ''}`}
                        onClick={() => setForm(prev => ({
                          ...prev,
                          peopleIds: selected ? prev.peopleIds.filter(id => id !== p.id) : [...prev.peopleIds, p.id],
                        }))}>
                        {p.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Place selector */}
              <select className="input-pill" value={form.placeId} onChange={e => setForm(p => ({ ...p, placeId: e.target.value }))}>
                <option value="">{t('memories.place', lang)} — {t('common.optional', lang)}</option>
                {places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAdd(false); setForm(getEmptyForm()); }}>{t('common.cancel', lang)}</button>
              <button className="btn-primary" style={{ flex: 2 }}
                onClick={() => { if (form.title.trim() && form.mood) { addMemory(form); setForm(getEmptyForm()); setShowAdd(false); } }}
                disabled={!form.title.trim() || !form.mood}>
                {t('common.save', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
