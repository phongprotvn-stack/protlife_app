import { useState, useMemo, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { Plus, Search, X, CalendarHeart, MapPin, Trash2, Edit3 } from 'lucide-react';
import { t, formatDate } from '../i18n';

const EVENT_TYPES = ['wedding', 'birthday', 'travel', 'party', 'sport', 'meeting', 'dinner', 'other'];

function getEmptyForm() {
  return { title: '', date: '', eventType: '', peopleIds: [], locationName: '', notes: '' };
}

export default function Events({ events, people, places, addEvent, updateEvent, deleteEvent }) {
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
      eventType: e.eventType || '',
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
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {e.date && <span>{formatDate(e.date)}</span>}
                      {e.eventType && <span> · {t(`events.${e.eventType}`, lang)}</span>}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input-pill" placeholder={t('events.eventTitle', lang)} value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              <input className="input-pill" type="date" placeholder={t('events.date', lang)} value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />

              {/* Event type */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>{t('events.eventType', lang)}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EVENT_TYPES.map(tp => (
                    <div key={tp} className={`chip ${form.eventType === tp ? 'active' : ''}`}
                      onClick={() => setForm(p => ({ ...p, eventType: tp }))}>
                      {t(`events.${tp}`, lang)}
                    </div>
                  ))}
                </div>
              </div>

              {/* People selector */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>{t('events.people', lang)}</div>
                {form.peopleIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {form.peopleIds.map(id => {
                      const p = people.find(x => x.id === id);
                      if (!p) return null;
                      return (
                        <div key={id} className="chip active" onClick={() => setForm(prev => ({ ...prev, peopleIds: prev.peopleIds.filter(x => x !== id) }))}>
                          {p.name} <X size={14} style={{ marginLeft: 4 }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input className="input-pill" style={{ paddingLeft: 36 }} placeholder={lang === 'vi' ? 'Tìm người tham gia...' : 'Search people...'}
                    value={personSearch} onChange={e => setPersonSearch(e.target.value)} />
                  {filteredPeople.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                      borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, marginTop: 4, padding: 4
                    }}>
                      {filteredPeople.map(p => (
                        <div key={p.id} style={{ padding: '10px 12px', fontSize: 14, cursor: 'pointer', borderRadius: 8 }}
                          onMouseEnter={e => e.target.style.background = '#F3F4F6'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                          onClick={() => { setForm(prev => ({ ...prev, peopleIds: [...prev.peopleIds, p.id] })); setPersonSearch(''); }}>
                          {p.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Place selector */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>{t('events.place', lang)}</div>
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
                          onClick={() => { setForm(prev => ({ ...prev, locationName: s.display_name })); setPlaceSuggestions([]); }}>
                          {s.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <textarea className="input-pill" placeholder={t('events.notes', lang)} value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 60 }} />
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
