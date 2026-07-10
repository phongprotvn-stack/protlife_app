import { useApp } from '../contexts/AppContext';
import { Heart, Users, MapPin, CalendarHeart, BookHeart, TrendingUp, Gift, Sparkles, Clock } from 'lucide-react';
import { t } from '../i18n';
import { getScoreInfo } from '../contexts/AppContext';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

export default function Dashboard({ people, events, memories, places, onShowPlaces, onShowTimeline }) {
  const { lifeScore, stats, suggestions, lang } = useApp();
  const scoreInfo = getScoreInfo(lifeScore.lifeScore);

  const scoreItems = [
    { key: 'relationships', label: t('dashboard.relationships', lang), value: lifeScore.relationships, color: '#E6002D' },
    { key: 'social', label: t('dashboard.social', lang), value: lifeScore.social, color: '#F59E0B' },
    { key: 'travel', label: t('dashboard.travel', lang), value: lifeScore.travel, color: '#10B981' },
    { key: 'health', label: t('dashboard.health', lang), value: lifeScore.health, color: '#3B82F6' },
    { key: 'learning', label: t('dashboard.learning', lang), value: lifeScore.learning, color: '#8B5CF6' },
    { key: 'emotion', label: t('dashboard.emotion', lang), value: lifeScore.emotion, color: '#EC4899' },
  ];

  const statCards = [
    { icon: Users, value: stats.totalPeople, label: t('dashboard.totalPeople', lang), color: '#E6002D', bg: 'rgba(230,0,45,0.08)' },
    { icon: CalendarHeart, value: stats.totalEvents, label: t('dashboard.totalEvents', lang), color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    { icon: BookHeart, value: stats.totalMemories, label: t('dashboard.totalMemories', lang), color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
    { icon: MapPin, value: stats.totalPlaces, label: t('dashboard.totalPlaces', lang), color: '#10B981', bg: 'rgba(16,185,129,0.08)', onClick: onShowPlaces },
  ];

  return (
    <div style={{ padding: 'var(--space-page-x)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#E6002D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
          {t('dashboard.lifeScoreSub', lang)}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
          {t('dashboard.yourLifeScore', lang)}
        </div>
      </div>

      {/* Life Score Hero */}
      <div className="card-life" style={{ padding: 28, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
          {lifeScore.lifeScore}
        </div>
        <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
          {t('dashboard.lifeScore', lang)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 14 }}>
            {scoreInfo.emoji} {t('people.' + scoreInfo.key, lang) || scoreInfo.key}
          </span>
        </div>
      </div>

      {/* Score Radar Chart */}
      <div className="card glass" style={{ marginBottom: 20 }}>
        <div className="title" style={{ marginBottom: 16 }}>📊 {t('dashboard.lifeScore', lang)}</div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={scoreItems}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ marginBottom: 20 }}>
        <div className="title" style={{ marginBottom: 12 }}>{t('dashboard.quickStats', lang)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: stat.onClick ? 'pointer' : 'default' }}
                onClick={stat.onClick ? () => stat.onClick() : undefined}>
                <div style={{ width: 44, height: 44, borderRadius: 16, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={22} color={stat.color} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{stat.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline button */}
      <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden', cursor: 'pointer' }}
        onClick={() => onShowTimeline()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px var(--space-card-inner)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={22} color="#8B5CF6" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t('timeline.title', lang)}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
              {lang === 'vi' ? 'Xem hoạt động theo dòng thời gian' : 'View all activities chronologically'}
            </div>
          </div>
          <TrendingUp size={20} color="#D1D5DB" />
        </div>
      </div>

      {/* Top Relationships */}
      {stats.topPeople.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="title" style={{ marginBottom: 12 }}>🏆 {t('dashboard.topRelationships', lang)}</div>
          {stats.topPeople.map((p, i) => {
            const s = getScoreInfo(p.relationshipScore || 0);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < stats.topPeople.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F1F1F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {s.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.emoji} {t('people.' + s.key, lang) || s.key}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#E6002D' }}>{p.relationshipScore || 0}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="title" style={{ marginBottom: 12 }}>💡 {t('dashboard.suggestions', lang)}</div>
          {suggestions.map(s => (
            <div key={s.id} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.titleVI || s.titleEN}</div>
                <div style={{ fontSize: 11, color: '#E6002D', fontWeight: 600, marginTop: 2 }}>
                  {s.actionVI || s.actionEN}
                </div>
              </div>
              {s.priority === 'high' && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#E6002D', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {people.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Heart size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>
            {t('dashboard.noData', lang)}
          </div>
          <div style={{ fontSize: 13, color: '#D1D5DB' }}>
            {t('app.tagline', lang)}
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
