import vi from './vi.json';
import en from './en.json';

const translations = { vi, en };

export function t(key, lang = 'vi', vars = {}) {
  const keys = key.split('.');
  let value = translations[lang];
  for (const k of keys) {
    value = value?.[k];
  }
  if (value !== undefined && typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  }
  return value !== undefined ? value : key;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateInput(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('-')) return dateStr;
  // Try DD/MM/YYYY -> YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

export function getDayName(dateStr, lang) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = lang === 'vi'
    ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()];
}

export function daysBetween(d1, d2) {
  const a = new Date(d1 + 'T00:00:00');
  const b = new Date(d2 + 'T00:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function getMoodColor(mood) {
  const map = {
    happy: '#E6002D',
    excited: '#F59E0B',
    peaceful: '#10B981',
    nostalgic: '#8B5CF6',
    grateful: '#3B82F6',
    inspired: '#EC4899',
    sad: '#6B7280',
    loved: '#E6002D',
  };
  return map[mood] || '#9CA3AF';
}
