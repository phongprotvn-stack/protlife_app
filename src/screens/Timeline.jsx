import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { Calendar, Clock, ArrowLeft, Heart, Users, MapPin, BookHeart, MessageCircle, Gift, Coffee, Phone, Star, ChevronRight } from 'lucide-react';
import { t, formatDate } from '../i18n';
import { motion } from 'framer-motion';
import { triggerHaptic } from '../utils/haptic';

const EVENT_ICONS = {
  meeting: '\ud83d\udc65', date: '\ud83d\udc91', party: '\ud83c\udf89',
  travel: '\u2708\ufe0f', holiday: '\ud83c\udf84', sports: '\u26bd',
  dinner: '\ud83c\udf7d\ufe0f', other: '\ud83d\udccc',
};

const MOOD_EMOJIS = {
  happy: '\ud83d\ude04', excited: '\ud83e\udd29', peaceful: '\ud83d\ude0c',
  grateful: '\ud83d\ude4f', loved: '\ud83d\udc96', inspired: '\u2728',
  sad: '\ud83d\ude22', nostalgic: '\ud83d\udc94',
};

const INTERACTION_ICONS = {
  call: '\ud83d\udcde', message: '\ud83d\udcac', meet: '\ud83d\udc65',
  coffee: '\u2615', gift: '\ud83c\udf81', other: '\ud83d\udccc',
};

export default function Timeline({ onClose }) {
  const { people, events, memories, lang, formatDate: fmt } = useApp();
  const [filterType, setFilterType] = useState('all');
  const [filterPerson, setFilterPerson] = useState('all');

  const allItems = useMemo(() => {
    const items = [];
    const personMap = {};
    people.forEach(p => { personMap[p.id] = p; });

    for (const e of events) {
      const dateStr = e.date || e.createdAt?.split('T')[0] || '';
      const related = (e.peopleIds || []).map(id => personMap[id]).filter(Boolean);
      items.push({
        id: e.id, type: 'event', date: dateStr, data: e,
        icon: EVENT_ICONS[e.eventType] || '\ud83d\udccc',
        title: e.name,
        subtitle: related.map(r => r.name).join(', '),
        personIds: e.peopleIds || [],
        color: '#E6002D',
      });
    }

    for (const m of memories) {
      const dateStr = m.date || m.createdAt?.split('T')[0] || '';
      const related = (m.peopleIds || []).map(id => personMap[id]).filter(Boolean);
      items.push({
        id: m.id, type: 'memory', date: dateStr, data: m,
        icon: MOOD_EMOJIS[m.mood] || '\ud83d\udcad',
        title: m.title || m.content?.slice(0, 50),
        subtitle: related.map(r => r.name).join(', '),
        personIds: m.peopleIds || [],
        color: '#8B5CF6',
      });
    }

    for (const p of people) {
      const interactions = p.interactions || [];
      for (const ix of interactions) {
        items.push({
          id: ix.id, type: 'interaction', date: ix.date, data: { ...ix, person: p },
          icon: INTERACTION_ICONS[ix.type] || '\ud83d\udccc',
          title: p.name,
          subtitle: ix.note || (ix.type === 'call' ? t('interactions.call', lang) : ix.type === 'message' ? t('interactions.message', lang) : t('interactions.' + ix.type, lang) || ix.type),
          personIds: [p.id], color: '#10B981',
        });
      }
    }

    items.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
    return items;
  }, [events, memories, people, lang]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterPerson !== 'all' && !item.personIds.includes(filterPerson)) return false;
      return true;
    });
  }, [allItems, filterType, filterPerson]);

  const today = new Date().toISOString().split('T')[0];
  const grouped = useMemo(() => {
    const groups = [];
    let currentGroup = null;
    for (const item of filtered) {
      const groupKey = item.date || 'unknown';
      if (!currentGroup || currentGroup.date !== groupKey) {
        const isToday = groupKey === today;
        const isFuture = groupKey > today;
        let label;
        if (groupKey === 'unknown') label = t('timeline.unknown', lang);
        else if (isToday) label = t('timeline.today', lang);
        else if (isFuture) label = t('timeline.upcoming', lang);
        else label = formatDate(groupKey, lang);
        currentGroup = { date: groupKey, label, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    }
    return groups;
  }, [filtered, today, lang]);

  return (
    <div className="screen">
      <div className="screen-header" style={{ borderBottom: 'none', paddingBottom: 4, marginBottom: 4 }}>
        <button className="btn-icon" onClick={() => { triggerHaptic('light'); onClose(); }} aria-label="Back"><ArrowLeft size={22} /></button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 16 }}>
          <Clock size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('nav.timeline', lang)}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none' }}>
        {[
          { value: 'all', label: t('timeline.all', lang) },
          { value: 'event', label: t('nav.events', lang) },
          { value: 'memory', label: t('nav.memories', lang) },
          { value: 'interaction', label: t('timeline.interactions', lang) },
        ].map(f => (
          <button key={f.value} onClick={() => setFilterType(f.value)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: 'none', background: filterType === f.value ? '#E6002D' : '#F3F4F6',
              color: filterType === f.value ? '#fff' : '#374151',
            }}>{f.label}</button>
        ))}
      </div>

      {/* Person filter */}
      <div style={{ padding: '0 16px 8px' }}>
        <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #E5E7EB',
            fontSize: 13, background: '#F9FAFB', color: '#374151',
          }}>
          <option value="all">{t('timeline.allPeople', lang)}</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {grouped.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
            <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div>{t('timeline.empty', lang)}</div>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.date} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
              letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4,
            }}>{group.label}</div>
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Timeline line */}
              <div style={{
                position: 'absolute', left: 10, top: 8, bottom: 0, width: 2,
                background: 'linear-gradient(to bottom, #E6002D, #FCA5A5)',
              }} />
              {group.items.map((item, idx) => (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.35, delay: Math.min(idx * 0.05, 0.3) }}
                  style={{
                  position: 'relative', marginBottom: 12, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)',
                  borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  marginLeft: 0,
                }}>
                  {/* Dot on timeline */}
                  <div style={{
                    position: 'absolute', left: -20, top: 14, width: 10, height: 10,
                    borderRadius: '50%', background: item.color, border: '2px solid #fff',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: '#fff', background: item.color, opacity: 0.8,
                      padding: '2px 8px', borderRadius: 8, flexShrink: 0,
                    }}>
                      {item.type === 'event' ? t('timeline.eventLabel', lang) : item.type === 'memory' ? t('timeline.memoryLabel', lang) : t('timeline.interactionLabel', lang)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
