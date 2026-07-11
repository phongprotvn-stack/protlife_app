import { useState, useMemo, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { Plus, Search, X, CalendarHeart, MapPin, Trash2, Edit3 } from 'lucide-react';
import { t, formatDate } from '../i18n';

const EVENT_TYPES = ['wedding', 'birthday', 'travel', 'party', 'sport', 'meeting', 'dinner', 'other'];

const MOOD_OPTIONS = ['', 'Happy', 'Normal', 'Sad', 'Excited', 'Tired', 'Angry', 'Thoughtful', 'Loved'];
const IMPORTANCE_OPTIONS = ['', '1 - Lowest', '2 - Low', '3 - Medium', '4 - High', '5 - Highest'];
const LIFE_STAGES = ['', 'Infancy', 'Childhood', 'Secondary School', 'High School', 'University', 'Early Career', 'Mid Career', 'Mature Career', 'Retirement'];
const SOURCE_OPTIONS = ['', 'Memory', 'Manual', 'Google Calendar', 'Google Photos', 'Facebook', 'Messenger', 'Zalo', 'Email', 'SMS', 'Document', 'ChatGPT', 'Google Timeline'];

function getEmptyForm() {
  return {
    title: '', date: '', endDate: '', eventType: '', mood: '', importance: '',
    lifeStage: '', source: '', cost: 0, mapLink: '',
    peopleIds: [], locationName: '', notes: '',
  };
}

export default function Events({ events, people, places, memories, addEvent, updateEvent, deleteEvent }) {
  const { lang } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [showModal, setShowModal] = useState(false);       // true = add/edit modal open
  const [editingEvent, setEditingEvent] = useState(null);  // null = add mode, event obj = edit mode
  const [form, setForm] = useState(getEmptyForm());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [personSearch, setPersonSearch] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const searchTimeout = useRef(null);

  const handlePlaceSearch = (text) => {
    setForm(p => ({ ...p, locationName: text }));
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text || text.length < 3) { setPlaceSuggestions([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(text)}`);
        const data = await res.json();
        setPlaceSuggestions(data);
      } catch (e) {}
    }, 500);
  };

  const filteredPeople = useMemo(() => {
    if (!personSearch) return [];
    return people.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase()) && !form.peopleIds.includes(p.id)).slice(0, 5);
  }, [people, personSearch, form.peopleIds]);

  const filtered = useMemo(() => {
    let list = [...events];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title?.toLowerCase().includes(q));
    }
    if (typeFilter) list = list.filter(e => e.eventType === typeFilter);
    return list.sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1));
  }, [events, search, typeFilter]);

  // Open modal for adding new event
  const openAdd = () => {
    setEditingEvent(null);
    setForm(getEmptyForm());
    setShowModal(true);
  };

  // Open modal for editing existing event
  const openEdit = (e) => {
    setEditingEvent(e);
    setForm({
      title: e.title || '',
      date: e.date || '',
      endDate: e.endDate || '',
      eventType: e.eventType || '',
      mood: e.mood || '',
      importance: e.importance || '',
      lifeStage: e.lifeStage || '',
      source: e.source || '',
      cost: e.cost ?? 0,
      mapLink: e.mapLink || '',
      peopleIds: e.peopleIds || [],
      locationName: e.locationName || '',
      notes: e.notes || '',
    });
    setShowModal(true);
  };

  // Save (add or update)
  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingEvent) {
      updateEvent(editingEvent.id, form);
    } else {
      addEvent(form);
    }
    setForm(getEmptyForm());
    setEditingEvent(null);
    setShowModal(false);
  };

  // Confirm delete
  const handleDelete = () => {
    if (editingEvent) deleteEvent(editingEvent.id);
    setShowDeleteConfirm(false);
    setShowModal(false);
    setEditingEvent(null);
  };

  // Event type emoji
  const eventEmoji = (tp) => {
    const map = { wedding: '💍', birthday: '🎂', travel: '✈️', party: '🎉', sport: '🏆', meeting: '🤝', dinner: '🍽️' };
    return map[tp] || '📌';
  };

  return (
    <div style={{ padding: 'var(--space-page-x)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{t('events.title', lang)}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>{events.length} {t('dashboard.totalEvents', lang)}</div>
        </div>
        <button onClick={openAdd}
          style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--grad-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(230,0,45,0.3)' }}>
          <Plus size={24} color="white" />
        </button>
      </div>

      {/* Search & Filter */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 14, top: 14 }} />
        <input className="input-pill" style={{ paddingLeft: 40 }} placeholder={t('events.searchEvents', lang)} value={search} onChange={e => setSearch(e.target.value)} />
        {search && <X size={18} color="#9CA3AF" style={{ position: 'absolute', right: 14, top: 14, cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        <div className={`chip ${!typeFilter ? 'active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setTypeFilter(null)}>
          {t('events.allTypes', lang)}
        </div>
        {EVENT_TYPES.map(tp => (
          <div key={tp} className={`chip ${typeFilter === tp ? 'active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => setTypeFilter(typeFilter === tp ? null : tp)}>
            {t(`events.${tp}`, lang)}
          </div>
        ))}
      </div>

      {/* Events list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <CalendarHeart size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9CA3AF' }}>{t('events.noEvents', lang)}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(e => {
            const eventPeople = (e.peopleIds || []).map(pid => people.find(p => p.id === pid)).filter(Boolean);
            const eventPlace = e.placeId ? places.find(p => p.id === e.placeId) : null;
            return (
              <div key={e.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }}
                onClick={() => openEdit(e)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 16, background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {eventEmoji(e.eventType)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{e.title}</div>
                      {(() => {
                        const count = (memories || []).filter(m => m.eventId === e.id).length;
                        return count > 0 ? (
                          <span style={{ fontSize: 10, background: '#EEF2FF', color: '#4F46E5', padding: '1px 8px', borderRadius: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            📝 {count}
                          </span>
                        ) : null;
                      })()}
                      {e.mood && <span style={{ fontSize: 11, color: '#9CA3AF' }}>· {e.mood}</span>}
                      {e.importance && <span className="chip-tag" style={{ fontSize: 9, padding: '1px 6px', background: e.importance?.includes('Highest') ? '#E6002D' : e.importance?.includes('High') ? '#F59E0B' : '#9CA3AF' }}>{e.importance}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {e.date && <span>{formatDate(e.date)}</span>}
                      {e.endDate && <span> → {formatDate(e.endDate)}</span>}
                      {e.eventType && <span> · {t(`events.${e.eventType}`, lang)}</span>}
                      {e.lifeStage && <span> · {e.lifeStage}</span>}
                      {e.source && <span> · 📌 {e.source}</span>}
                    </div>
                    {eventPeople.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {eventPeople.slice(0, 3).map(p => (
                          <span key={p.id} style={{ fontSize: 11, background: '#F1F1F4', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            {p.name}
                          </span>
                        ))}
                        {eventPeople.length > 3 && <span style={{ fontSize: 11, color: '#9CA3AF' }}>+{eventPeople.length - 3}</span>}
                      </div>
                    )}
                    {e.locationName && (
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {e.locationName}
                      </div>
                    )}
                    {e.cost > 0 && (
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        💰 {e.cost.toLocaleString()}đ
                      </div>
                    )}
                    {e.mapLink && (
                      <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>
                        🔗 {e.mapLink}
                      </div>
                    )}
                  </div>
                </div>
                {e.notes && <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginTop: 8 }}>{e.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingEvent(null); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
              {editingEvent ? 'Chỉnh sửa sự kiện' : t('events.addEvent', lang)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ─── Event Name ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  📝 {t('events.eventTitle', lang)}
                </div>
                <input className="input-pill" placeholder={lang === 'vi' ? 'Nhập tên sự kiện...' : 'Enter event name...'} value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>

              {/* ─── Date Range ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  📅 {t('events.date', lang)}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input-pill" type="date" style={{ flex: 1 }} placeholder="Ngày bắt đầu" value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600 }}>→</span>
                  <input className="input-pill" type="date" style={{ flex: 1 }} placeholder="Ngày kết thúc" value={form.endDate}
                    onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>

              {/* ─── Event Type ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  🏷️ {t('events.eventType', lang)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EVENT_TYPES.map(tp => (
                    <div key={tp} className={`chip ${form.eventType === tp ? 'active' : ''}`}
                      onClick={() => setForm(p => ({ ...p, eventType: tp }))}>
                      {t(`events.${tp}`, lang)}
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── Mood + Importance + LifeStage + Source ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  🎭 Chi tiết cảm xúc
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 3 }}>Tâm trạng</div>
                    <select className="input-pill" value={form.mood}
                      onChange={e => setForm(p => ({ ...p, mood: e.target.value }))}>
                      {MOOD_OPTIONS.map(m => <option key={m} value={m}>{m || '-- Chọn --'}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 3 }}>Mức độ</div>
                    <select className="input-pill" value={form.importance}
                      onChange={e => setForm(p => ({ ...p, importance: e.target.value }))}>
                      {IMPORTANCE_OPTIONS.map(i => <option key={i} value={i}>{i || '-- Chọn --'}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 3 }}>Giai đoạn cuộc sống</div>
                    <select className="input-pill" value={form.lifeStage}
                      onChange={e => setForm(p => ({ ...p, lifeStage: e.target.value }))}>
                      {LIFE_STAGES.map(ls => <option key={ls} value={ls}>{ls || '-- Chọn --'}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 3 }}>Nguồn</div>
                    <select className="input-pill" value={form.source}
                      onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                      {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s || '-- Chọn --'}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ─── Location + Google Maps Link (combined) ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  📍 {t('events.place', lang)}
                </div>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input className="input-pill" style={{ paddingLeft: 36 }}
                    placeholder={lang === 'vi' ? 'Tìm địa điểm...' : 'Search location...'}
                    value={form.locationName} onChange={e => handlePlaceSearch(e.target.value)} />
                  {placeSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                      borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10, marginTop: 4, padding: 4, maxHeight: 200, overflowY: 'auto'
                    }}>
                      {placeSuggestions.map(s => (
                        <div key={s.place_id} style={{ padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 8, borderBottom: '1px solid #F3F4F6' }}
                          onMouseEnter={e => e.target.style.background = '#F3F4F6'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                          onClick={() => {
                            setForm(prev => ({ ...prev, locationName: s.display_name }));
                            setPlaceSuggestions([]);
                          }}>
                          {s.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Google Maps Link — directly below location */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap' }}>🔗 Google Maps:</span>
                  <input className="input-pill" style={{ flex: 1, fontSize: 12 }} placeholder="https://maps.google.com/..." value={form.mapLink}
                    onChange={e => setForm(p => ({ ...p, mapLink: e.target.value }))} />
                </div>
              </div>

              {/* ─── Cost ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  💰 Chi phí
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="input-pill" type="number" style={{ flex: 1 }} placeholder="0" value={form.cost}
                    onChange={e => setForm(p => ({ ...p, cost: parseInt(e.target.value) || 0 }))} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>VNĐ</span>
                </div>
              </div>

              {/* ─── Notes ─── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  📝 {t('events.notes', lang)}
                </div>
                <textarea className="input-pill" placeholder={lang === 'vi' ? 'Nhập ghi chú...' : 'Enter notes...'} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 70, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {editingEvent && (
                <button className="btn-secondary" style={{ padding: '10px 16px', color: '#E6002D' }}
                  onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={16} style={{ marginRight: 6 }} />Xoá
                </button>
              )}
              <button className="btn-secondary" style={{ flex: 1 }}
                onClick={() => { setShowModal(false); setEditingEvent(null); setForm(getEmptyForm()); }}>
                {t('common.cancel', lang)}
              </button>
              <button className="btn-primary" style={{ flex: 2 }}
                onClick={handleSave} disabled={!form.title.trim()}>
                {editingEvent ? 'Cập nhật' : t('common.save', lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-handle" />
            <Trash2 size={40} color="#E6002D" style={{ marginBottom: 12, marginTop: 8 }} />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Xoá sự kiện này?</div>
            <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>
              "{editingEvent?.title}" sẽ bị xoá vĩnh viễn.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>Huỷ</button>
              <button className="btn-primary" style={{ flex: 1, background: '#E6002D' }} onClick={handleDelete}>Xoá</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
