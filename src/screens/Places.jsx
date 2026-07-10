import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Plus, Search, X, MapPin, ArrowLeft, Map as MapIcon, List } from 'lucide-react';
import { t } from '../i18n';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { triggerHaptic } from '../utils/haptic';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const PLACE_TYPES = ['lived', 'visited', 'wantToVisit'];

export default function Places({ places, addPlace, updatePlace, deletePlace, onBack }) {
  const { lang } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return { name: '', nameEn: '', country: '', type: 'visited', rating: 5, review: '', startDate: '', endDate: '', photos: [], lat: null, lng: null };
  }

  const filtered = useMemo(() => {
    let list = [...places];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.nameEn?.toLowerCase().includes(q));
    }
    if (typeFilter) list = list.filter(p => p.type === typeFilter);
    return list;
  }, [places, search, typeFilter]);

  const typeCounts = useMemo(() => ({
    lived: places.filter(p => p.type === 'lived').length,
    visited: places.filter(p => p.type === 'visited').length,
    wantToVisit: places.filter(p => p.type === 'wantToVisit').length,
  }), [places]);

  // Go back
  const goBack = () => {
    triggerHaptic('light');
    if (onBack) onBack();
    else if (typeof window !== 'undefined' && window.history?.length > 1) window.history.back();
  };

  async function geocodeAndAdd(placeForm) {
    let lat = 21.0285 + (Math.random() - 0.5) * 5;
    let lng = 105.8542 + (Math.random() - 0.5) * 5;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeForm.name + ' ' + placeForm.country)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
      }
    } catch (e) {}
    addPlace({ ...placeForm, lat, lng });
  }

  return (
    <div style={{ padding: 'var(--space-page-x)' }}>
      {/* Header with back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div onClick={goBack} style={{ width: 40, height: 40, borderRadius: 20, background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{t('places.title', lang)}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>{places.length} {t('dashboard.totalPlaces', lang)}</div>
        </div>
        <div className="segmented" style={{ width: 80 }}>
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => { triggerHaptic('light'); setViewMode('list'); }} style={{ padding: '6px' }}>
            <List size={16} />
          </button>
          <button className={viewMode === 'map' ? 'active' : ''} onClick={() => { triggerHaptic('light'); setViewMode('map'); }} style={{ padding: '6px' }}>
            <MapIcon size={16} />
          </button>
        </div>
        <button onClick={() => { triggerHaptic('light'); setShowAdd(true); }}
          style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--grad-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(230,0,45,0.3)' }}>
          <Plus size={20} color="white" />
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={18} color="#9CA3AF" style={{ position: 'absolute', left: 14, top: 14 }} />
        <input className="input-pill" style={{ paddingLeft: 40 }} placeholder={t('places.searchPlaces', lang)} value={search} onChange={e => setSearch(e.target.value)} />
        {search && <X size={18} color="#9CA3AF" style={{ position: 'absolute', right: 14, top: 14, cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        <div className={`chip ${!typeFilter ? 'active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setTypeFilter(null)}>
          {t('places.allTypes', lang)} ({places.length})
        </div>
        {PLACE_TYPES.map(tp => (
          <div key={tp} className={`chip ${typeFilter === tp ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => setTypeFilter(typeFilter === tp ? null : tp)}>
            {t(`places.${tp}`, lang)} ({typeCounts[tp]})
          </div>
        ))}
      </div>

      {viewMode === 'map' ? (
        <div className="card" style={{ height: 'calc(100vh - 220px)', padding: 0, overflow: 'hidden' }}>
          <MapContainer center={[21.0285, 105.8542]} zoom={4} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {filtered.map(p => {
              if (p.lat && p.lng) {
                return (
                  <Marker key={p.id} position={[p.lat, p.lng]}>
                    <Popup>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div>{t(`places.${p.type}`, lang)}</div>
                    </Popup>
                  </Marker>
                );
              }
              return null;
            })}
          </MapContainer>
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <MapPin size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#9CA3AF' }}>{t('places.noPlaces', lang)}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(p => {
                const typeColors = { lived: '#E6002D', visited: '#10B981', wantToVisit: '#8B5CF6' };
                const typeIcons = { lived: '🏠', visited: '📍', wantToVisit: '⭐' };
                return (
                  <div key={p.id} className="card glass" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                    onClick={() => {
                      triggerHaptic('medium');
                      if (confirm(lang === 'vi' ? `Xoá "${p.name}"?` : `Delete "${p.name}"?`)) {
                        deletePlace(p.id);
                      }
                    }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 16,
                      background: `${typeColors[p.type] || '#9CA3AF'}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {typeIcons[p.type] || '📍'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                        <span className="chip-tag" style={{ background: typeColors[p.type] || '#9CA3AF', fontSize: 10 }}>
                          {t(`places.${p.type}`, lang)}
                        </span>
                        {p.country && <span style={{ marginLeft: 8 }}>{p.country}</span>}
                        {p.rating && <span style={{ marginLeft: 8 }}>{'⭐'.repeat(p.rating)}</span>}
                      </div>
                      {p.review && <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginTop: 4 }}>"{p.review}"</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add Place Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{t('places.addPlace', lang)}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input-pill" placeholder={t('places.name', lang)} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              <input className="input-pill" placeholder={t('places.nameEn', lang)} value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} />
              <input className="input-pill" placeholder={t('places.country', lang)} value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>{t('places.type', lang)}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PLACE_TYPES.map(tp => (
                    <div key={tp} className={`chip ${form.type === tp ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setForm(p => ({ ...p, type: tp }))}>
                      {tp === 'lived' ? '🏠' : tp === 'visited' ? '📍' : '⭐'} {t(`places.${tp}`, lang)}
                    </div>
                  ))}
                </div>
              </div>

              {form.type === 'lived' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input className="input-pill" type="date" placeholder={t('places.startDate', lang)} value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
                  <input className="input-pill" type="date" placeholder={t('places.endDate', lang)} value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>{t('places.rating', lang)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(r => (
                    <div key={r} onClick={() => setForm(p => ({ ...p, rating: r }))}
                      style={{ fontSize: 28, cursor: 'pointer', filter: form.rating >= r ? 'none' : 'grayscale(1)', opacity: form.rating >= r ? 1 : 0.3 }}>
                      ⭐
                    </div>
                  ))}
                </div>
              </div>

              <textarea className="input-pill" placeholder={t('places.review', lang)} value={form.review} onChange={e => setForm(p => ({ ...p, review: e.target.value }))} style={{ minHeight: 60 }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { triggerHaptic('light'); setShowAdd(false); setForm(getEmptyForm()); }}>{t('common.cancel', lang)}</button>
              <button className="btn-primary" style={{ flex: 2 }}
                onClick={() => { triggerHaptic('success'); if (form.name.trim()) { geocodeAndAdd(form); setForm(getEmptyForm()); setShowAdd(false); } }}
                disabled={!form.name.trim()}>
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
