import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthChange, signInWithGoogle as fbSignInGoogle,
  signInWithEmail as fbSignInEmail, signUpWithEmail as fbSignUpEmail,
  signOutUser as fbSignOut,
  getGoogleRedirectResult,
  loadTagsFromFirestore, subscribeToFirestore,
} from '../firebase/firebase';
import { initApiClient, apiPeople, apiEvents, apiMemories, apiPlaces, apiGroups, apiDataHub } from '../api/client';
import { apiAuth } from '../api/client';

const AppContext = createContext();

const KEYS = {
  people: 'protlife_people', events: 'protlife_events',
  memories: 'protlife_memories', places: 'protlife_places',
  tags: 'protlife_tags', settings: 'protlife_settings',
  scoreHistory: 'protlife_score_history',
};

const DEFAULT_TAGS = [
  { id: 'nuclear_family', nameVI: 'Gia đình ruột', nameEN: 'Nuclear Family', icon: 'home', color: '#E6002D' },
  { id: 'extended_family', nameVI: 'Họ hàng', nameEN: 'Extended Family', icon: 'users', color: '#F59E0B' },
  { id: 'high_school', nameVI: 'Bạn cấp 3', nameEN: 'High School', icon: 'graduation-cap', color: '#10B981' },
  { id: 'college', nameVI: 'Bạn đại học', nameEN: 'College', icon: 'book-open', color: '#3B82F6' },
  { id: 'sport', nameVI: 'Bạn thể thao', nameEN: 'Sport Buddies', icon: 'trophy', color: '#8B5CF6' },
  { id: 'former_colleague', nameVI: 'Đồng nghiệp cũ', nameEN: 'Former Colleague', icon: 'briefcase', color: '#EC4899' },
  { id: 'current_colleague', nameVI: 'Đồng nghiệp mới', nameEN: 'Current Colleague', icon: 'building', color: '#6366F1' },
  { id: 'pickleball', nameVI: 'Pickleball', nameEN: 'Pickleball', icon: 'target', color: '#E6002D' },
  { id: 'other', nameVI: 'Khác', nameEN: 'Other', icon: 'more-horizontal', color: '#9CA3AF' },
];

const DEFAULT_SETTINGS = { lang: 'vi', loggedIn: false, displayName: 'PROT', email: '', userId: '' };

const SCORE_LEVELS = [
  { min: 1, max: 29, key: 'scoreAcquainted', emoji: '⚪', color: '#9CA3AF' },
  { min: 30, max: 49, key: 'scoreFriendly', emoji: '🟢', color: '#10B981' },
  { min: 50, max: 69, key: 'scoreCloseFriend', emoji: '🔵', color: '#3B82F6' },
  { min: 70, max: 89, key: 'scoreIntimate', emoji: '🟣', color: '#8B5CF6' },
  { min: 90, max: 100, key: 'scoreSoulmate', emoji: '❤️', color: '#E6002D' },
];

export function getScoreInfo(score) {
  if (score <= 0) return { min: 0, max: 0, key: 'scoreNone', emoji: '👤', color: '#D1D5DB' };
  return SCORE_LEVELS.find(l => score >= l.min && score <= l.max) || SCORE_LEVELS[0];
}

function loadJSON(key, def) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; }
  catch { return def; }
}
function persist(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function daysBetween(d1, d2) {
  if (!d1 || !d2) return 0;
  return Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
}

function calcLifeScore(people, events, memories, places) {
  const relScore = people.length > 0
    ? Math.round(people.reduce((s, p) => s + (p.relationshipScore || 0), 0) / people.length) : 0;
  const socialRaw = Math.min(people.length * 4 + events.length * 1.5, 100);
  const visitedPlaces = places.filter(p => p.type === 'visited' || p.type === 'lived').length;
  const travelRaw = Math.min(visitedPlaces * 12 + places.filter(p => p.type === 'wantToVisit').length * 5, 100);
  const health = 70;
  const learningRaw = Math.min(memories.length * 3, 100);
  const positiveMoods = memories.filter(m => ['happy','excited','peaceful','grateful','inspired','loved'].includes(m.mood)).length;
  const emotionRaw = memories.length > 0 ? Math.round((positiveMoods / memories.length) * 100) : 50;
  const scores = {
    relationships: relScore, social: Math.round(socialRaw), travel: Math.round(travelRaw),
    health, learning: Math.round(learningRaw), emotion: Math.round(emotionRaw),
  };
  const lifeScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 6);
  return { lifeScore, ...scores };
}

function generateSuggestions(people, events, memories, lang, places) {
  const suggestions = [];
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const todayDate = new Date();

  for (const p of people) {
    const tags = p.tags || [];
    const isFamily = tags.some(t => t.id === 'nuclear_family' || t.id === 'extended_family');
    const isFriend = tags.some(t => t.id === 'high_school' || t.id === 'college');
    const lastContact = p.lastInteractionDate || p.createdAt?.split('T')[0] || today;
    const days = daysBetween(lastContact, today);

    // Relationship Care Rule
    if (days > 14 && days < 1000) {
      if (isFamily && days > 30) {
        suggestions.push({
          id: genId(), type: 'relationship_care', priority: 'high', icon: '🤗', personId: p.id,
          titleVI: `Gia đình: Đã ${days} ngày chưa trò chuyện với ${p.name}`,
          titleEN: `Family: Haven't talked to ${p.name} in ${days} days`,
          actionVI: 'Gọi điện hỏi thăm / Mua quà tặng', actionEN: 'Call now / Buy gift',
        });
      } else if (!isFamily && days > 14) {
        suggestions.push({
          id: genId(), type: 'relationship_care', priority: 'medium', icon: '🍻', personId: p.id,
          titleVI: `Bạn bè/Đồng nghiệp: Đã (${days} ngày) chưa gặp ${p.name}`,
          titleEN: `Friend: Haven't seen ${p.name} in ${days} days`,
          actionVI: 'Rủ đi cafe / Đi nhậu', actionEN: 'Invite for coffee / drink',
        });
      }
    }

    // Birthday Rule
    if (p.dob) {
      let m, d;
      // Handle both yyyy-mm-dd and dd/mm/yyyy
      if (p.dob.includes('/')) {
        const parts = p.dob.split('/');
        d = parseInt(parts[0]);
        m = parseInt(parts[1]);
      } else {
        const parts = p.dob.split('-');
        m = parseInt(parts[1]);
        d = parseInt(parts[2]);
      }
      // Create birthday for this year
      let bdThisYear = new Date(todayDate.getFullYear(), m - 1, d);
      // If birthday already passed this year, look at next year
      if (bdThisYear < new Date(todayDate.getTime() - 86400000)) {
        bdThisYear = new Date(todayDate.getFullYear() + 1, m - 1, d);
      }
      const diff = Math.round((bdThisYear - todayDate) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= 14) {
        suggestions.push({
          id: genId(), type: 'birthday_reminder', priority: 'high', icon: '🎂', personId: p.id,
          titleVI: `Sinh nhật ${p.name} sắp tới! (còn ${diff} ngày)`,
          titleEN: `${p.name}'s birthday is coming! (in ${diff} days)`,
          actionVI: 'Mua quà / Tổ chức sinh nhật 🎁', actionEN: 'Buy gift / Organize party 🎁',
        });
      }
    }
  }

  const lowScore = people.filter(p => (p.relationshipScore || 0) < 40 && (p.relationshipScore || 0) > 0);
  if (lowScore.length > 0) {
    suggestions.push({
      id: genId(), type: 'relationship_boost', priority: 'medium', icon: '💪',
      titleVI: `${lowScore.length} mối quan hệ đang mờ nhạt`,
      titleEN: `${lowScore.length} relationships are fading`,
      actionVI: 'Lên kế hoạch hâm nóng', actionEN: 'Plan to reconnect',
    });
  }

  const wantToVisit = places.filter(p => p.type === 'wantToVisit');
  if (wantToVisit.length > 0) {
    suggestions.push({
      id: genId(), type: 'travel_goal', priority: 'low', icon: '✈️',
      titleVI: `Bạn còn ${wantToVisit.length} nơi muốn đến: ${wantToVisit.slice(0, 2).map(p => p.name).join(', ')}...`,
      titleEN: `You still want to visit ${wantToVisit.length} places...`,
      actionVI: 'Lên kế hoạch du lịch', actionEN: 'Plan travel',
    });
  }

  if (memories.length === 0) {
    suggestions.push({
      id: genId(), type: 'first_memory', priority: 'high', icon: '💭',
      titleVI: 'Hãy ghi lại ký ức đầu tiên của bạn!',
      titleEN: 'Record your first memory!',
      actionVI: 'Viết ký ức', actionEN: 'Write memory',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: genId(), type: 'welcome_message', priority: 'high', icon: '✨',
      titleVI: 'Hôm nay là một ngày tuyệt vời!',
      titleEN: 'Today is a wonderful day!',
      actionVI: 'Bắt đầu hành trình nào', actionEN: 'Let\'s begin',
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return suggestions.slice(0, 5); // Max 5 suggestions
}

export function AppProvider({ children }) {
  const [people, setPeople] = useState(() => loadJSON(KEYS.people, []));
  const [events, setEvents] = useState(() => loadJSON(KEYS.events, []));
  const [memories, setMemories] = useState(() => loadJSON(KEYS.memories, []));
  const [places, setPlaces] = useState(() => loadJSON(KEYS.places, []));
  const [tags, setTags] = useState(() => loadJSON(KEYS.tags, DEFAULT_TAGS));
  const [settings, setSettings] = useState(() => loadJSON(KEYS.settings, DEFAULT_SETTINGS));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scoreHistory, setScoreHistory] = useState(() => loadJSON(KEYS.scoreHistory, []));
  const [userRole, setUserRole] = useState(null);
  const [groups, setGroups] = useState([]);
  const unsubscribeRef = useRef(null);

  const lang = settings.lang;
  const isLoggedIn = !!user;

  // Persist to localStorage
  useEffect(() => { persist(KEYS.people, people); }, [people]);
  useEffect(() => { persist(KEYS.events, events); }, [events]);
  useEffect(() => { persist(KEYS.memories, memories); }, [memories]);
  useEffect(() => { persist(KEYS.places, places); }, [places]);
  useEffect(() => { persist(KEYS.tags, tags); }, [tags]);
  useEffect(() => { persist(KEYS.settings, settings); }, [settings]);
  useEffect(() => { persist(KEYS.scoreHistory, scoreHistory); }, [scoreHistory]);

  // Init API client
  useEffect(() => {
    initApiClient();
  }, []);

  // Firebase Auth listener + handle redirect result (iOS PWA)
  useEffect(() => {
    // Handle redirect from Google sign-in (iOS PWA / standalone)
    getGoogleRedirectResult().then(user => {
      if (user) {
        console.log('🔐 Google redirect sign-in successful:', user.email);
      }
    });
    const unsub = onAuthChange(async (fbUser) => {
      if (fbUser) {
        setUser({ uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User' });
        setSettings(prev => ({ ...prev, loggedIn: true, email: fbUser.email || '', userId: fbUser.uid, displayName: fbUser.displayName || prev.displayName }));
        // Get role from API
        try {
          const idToken = await fbUser.getIdToken();
          const me = await apiAuth.verify(idToken);
          console.log('🔐 API verify response:', JSON.stringify(me));
          setUserRole(me.role || 'editor');
        } catch (err) {
          console.error('🔐 Role API failed:', err.message || err);
          // Fallback: check email locally
          const localRole = fbUser.email === 'phongprot.vn@gmail.com' || fbUser.uid === 'bFltKLpP5yPtrryMtBmbJ1Ydjr93' ? 'admin' : 'viewer';
          console.log('🔐 Using local fallback role:', localRole);
          setUserRole(localRole);
        }
      } else {
        setUser(null);
        setUserRole(null);
        setSettings(prev => ({ ...prev, loggedIn: false, userId: '' }));
      }
    });
    return unsub;
  }, []);

  // Firestore real-time listener for reads (only when logged in)
  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;
    let unsub;

    (async () => {
      // Load tags first
      try {
        const fbTags = await loadTagsFromFirestore(user.uid);
        if (fbTags && mounted) setTags(fbTags);
      } catch {}

      // Subscribe to real-time updates from Firestore
      unsub = subscribeToFirestore(user.uid, (coll, data) => {
        if (!mounted) return;
        const strData = JSON.stringify(data);
        // Don't overwrite if local was just written by API (will be updated by listener)
        switch (coll) {
          case 'people': setPeople(data); break;
          case 'events': setEvents(data); break;
          case 'memories': setMemories(data); break;
          case 'places': setPlaces(data); break;
          case 'groups': setGroups(data); break;
        }
      });

      // Refresh on visibility change (cross-device sync)
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          if (unsub) unsub();
          unsub = subscribeToFirestore(user.uid, (coll, data) => {
            if (!mounted) return;
            switch (coll) {
              case 'people': setPeople(data); break;
              case 'events': setEvents(data); break;
              case 'memories': setMemories(data); break;
              case 'places': setPlaces(data); break;
              case 'groups': setGroups(data); break;
            }
          });
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      unsubscribeRef.current = () => {
        if (unsub) unsub();
        document.removeEventListener('visibilitychange', onVisible);
      };
    })();

    return () => { mounted = false; if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, [user?.uid]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Life Score
  const lifeScore = calcLifeScore(people, events, memories, places);
  const suggestions = generateSuggestions(people, events, memories, lang, places);

  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    setScoreHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.date === today && last.score === lifeScore.lifeScore) return prev;
      const entry = { date: today, score: lifeScore.lifeScore, ...lifeScore };
      const cleaned = prev.filter(e => e.date !== today);
      return [...cleaned, entry].slice(-90);
    });
  }, [lifeScore.lifeScore]);

  const stats = {
    totalPeople: people.length, totalEvents: events.length,
    totalMemories: memories.length, totalPlaces: places.length,
    totalPhotos: memories.reduce((s, m) => s + (m.photos?.length || 0), 0),
    topPeople: [...people].sort((a, b) => (b.relationshipScore || 0) - (a.relationshipScore || 0)).slice(0, 5),
    peopleByTag: tags.map(t => ({ ...t, count: people.filter(p => (p.tags || []).some(pt => pt.id === t.id)).length })),
  };

  // ─── CRUD: People (all writes go through API) ───
  const addPerson = useCallback(async (person) => {
    const p = {
      ...person,
      id: genId(),
      createdAt: new Date().toISOString(),
      status: person.status || 'Active',
      isFavorite: person.isFavorite ?? false,
      source: person.source || '',
    };
    setPeople(prev => [...prev, p]); // optimistic local update
    try {
      const result = await apiPeople.create(p);
      showToast('Đã thêm ' + p.name);
      return result;
    } catch (e) {
      setPeople(prev => prev.filter(x => x.id !== p.id)); // rollback
      showToast('Lỗi: ' + e.message);
    }
  }, [showToast]);

  const updatePerson = useCallback(async (id, updates) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));
    try {
      await apiPeople.update(id, updates);
    } catch (e) {
      showToast('Lỗi: ' + e.message);
    }
  }, [showToast]);

  const deletePerson = useCallback(async (id) => {
    const p = people.find(x => x.id === id);
    setPeople(prev => prev.filter(x => x.id !== id));
    setEvents(prev => prev.map(e => ({ ...e, peopleIds: (e.peopleIds || []).filter(pid => pid !== id) })));
    setMemories(prev => prev.map(m => ({ ...m, peopleIds: (m.peopleIds || []).filter(pid => pid !== id) })));
    try {
      await apiPeople.delete(id);
      if (p) showToast('Đã xoá ' + p.name);
    } catch (e) {
      showToast('Lỗi: ' + e.message);
    }
  }, [showToast, people]);

  const addInteraction = useCallback(async (personId, interaction) => {
    const newInteraction = { id: genId(), date: new Date().toISOString().split('T')[0], ...interaction };
    setPeople(prev => prev.map(p => {
      if (p.id !== personId) return p;
      const interactions = p.interactions || [];
      return { ...p, interactions: [...interactions, newInteraction], lastInteractionDate: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString() };
    }));
    try {
      await apiPeople.update(personId, {
        interactions: [...((people.find(p => p.id === personId)?.interactions) || []), newInteraction],
        lastInteractionDate: new Date().toISOString().split('T')[0],
      });
      showToast('Đã ghi nhận tương tác');
    } catch (e) {
      showToast('Lỗi: ' + e.message);
    }
  }, [showToast, people]);

  // ─── CRUD: Events ───
  const addEvent = useCallback(async (event) => {
    const e = {
      ...event,
      id: genId(),
      createdAt: new Date().toISOString(),
      endDate: event.endDate || '',
      mood: event.mood || '',
      importance: event.importance || '',
      lifeStage: event.lifeStage || '',
      source: event.source || '',
      cost: event.cost ?? 0,
      mapLink: event.mapLink || '',
    };
    setEvents(prev => [...prev, e]);
    try {
      const result = await apiEvents.create(e);
      showToast('Đã thêm sự kiện');
      return result;
    } catch (e2) {
      setEvents(prev => prev.filter(x => x.id !== e.id));
      showToast('Lỗi: ' + e2.message);
    }
  }, [showToast]);

  const updateEvent = useCallback(async (id, updates) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e));
    try { await apiEvents.update(id, updates); } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast]);

  const deleteEvent = useCallback(async (id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    try { await apiEvents.delete(id); showToast('Đã xoá sự kiện'); } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast]);

  // ─── CRUD: Memories ───
  const addMemory = useCallback(async (memory) => {
    const m = { ...memory, id: genId(), createdAt: new Date().toISOString() };
    setMemories(prev => [...prev, m]);
    try {
      const result = await apiMemories.create(m);
      showToast('Đã thêm ký ức');
      return result;
    } catch (e2) {
      setMemories(prev => prev.filter(x => x.id !== m.id));
      showToast('Lỗi: ' + e2.message);
    }
  }, [showToast]);

  const updateMemory = useCallback(async (id, updates) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m));
    try { await apiMemories.update(id, updates); } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast]);

  const deleteMemory = useCallback(async (id) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    try { await apiMemories.delete(id); showToast('Đã xoá ký ức'); } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast]);

  // ─── CRUD: Places ───
  const addPlace = useCallback(async (place) => {
    const p = { ...place, id: genId(), createdAt: new Date().toISOString() };
    setPlaces(prev => [...prev, p]);
    try {
      const result = await apiPlaces.create(p);
      showToast('Đã thêm ' + place.name);
      return result;
    } catch (e2) {
      setPlaces(prev => prev.filter(x => x.id !== p.id));
      showToast('Lỗi: ' + e2.message);
    }
  }, [showToast]);

  const updatePlace = useCallback(async (id, updates) => {
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));
    try { await apiPlaces.update(id, updates); } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast]);

  const deletePlace = useCallback(async (id) => {
    const p = places.find(x => x.id === id);
    setPlaces(prev => prev.filter(x => x.id !== id));
    try {
      await apiPlaces.delete(id);
      if (p) showToast('Đã xoá ' + p.name);
    } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast, places]);

  // ─── Tags ───
  const addTag = useCallback((tag) => {
    const t = { id: genId(), ...tag };
    setTags(prev => [...prev, t]);
    showToast('Đã thêm nhóm ' + (tag.nameVI || tag.nameEN));
    return t;
  }, [showToast]);

  const updateTag = useCallback((id, updates) => {
    setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setPeople(prev => prev.map(p => ({ ...p, tags: (p.tags || []).map(pt => pt.id === id ? { ...pt, ...updates } : pt) })));
    showToast('Đã cập nhật nhóm');
  }, [showToast]);

  const deleteTag = useCallback((id) => {
    setTags(prev => prev.filter(t => t.id !== id));
    setPeople(prev => prev.map(p => ({ ...p, tags: (p.tags || []).filter(pt => pt.id !== id) })));
    showToast('Đã xoá nhóm');
  }, [showToast]);

  // ─── Groups CRUD ───
  const addGroup = useCallback(async (group) => {
    const g = { id: 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ...group, createdAt: new Date().toISOString() };
    setGroups(prev => [...prev, g]);
    try {
      await apiGroups.create(g);
      showToast('Đã thêm tổ chức: ' + (group.name || ''));
    } catch (e) {
      setGroups(prev => prev.filter(x => x.id !== g.id));
      showToast('Lỗi: ' + e.message);
    }
    return g;
  }, [showToast]);

  const updateGroup = useCallback(async (id, updates) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    try { await apiGroups.update(id, updates); showToast('Đã cập nhật tổ chức'); } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast]);

  const deleteGroup = useCallback(async (id) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    // Also remove groupId from people
    setPeople(prev => prev.map(p => p.groupId === id ? { ...p, groupId: null, organization: '' } : p));
    try { await apiGroups.delete(id); showToast('Đã xoá tổ chức'); } catch (e) { showToast('Lỗi: ' + e.message); }
  }, [showToast]);

  const toggleLang = useCallback(() => {
    setSettings(prev => ({ ...prev, lang: prev.lang === 'vi' ? 'en' : 'vi' }));
  }, []);

  const exportData = useCallback(async () => {
    try {
      const data = await apiDataHub.exportJson();
      const blob = new Blob(['\ufeff' + JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'protlife_export_' + new Date().toISOString().split('T')[0] + '.json'; a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất dữ liệu');
    } catch (e) { showToast('Lỗi xuất: ' + e.message); }
  }, [showToast]);

  const importData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.people) {
            await apiDataHub.importJson(data.people);
            setPeople(data.people);
          }
          if (data.events) setEvents(data.events);
          if (data.memories) setMemories(data.memories);
          if (data.places) setPlaces(data.places);
          if (data.tags) setTags(data.tags);
          showToast('Đã nhập dữ liệu thành công!');
        } catch { showToast('File không hợp lệ'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [showToast]);

  const clearAllData = useCallback(() => {
    if (!confirm(lang === 'vi' ? 'Xoá tất cả dữ liệu?' : 'Delete all data?')) return;
    setPeople([]); setEvents([]); setMemories([]); setPlaces([]); setTags(DEFAULT_TAGS);
    setScoreHistory([]);
    showToast(lang === 'vi' ? 'Đã xoá tất cả dữ liệu' : 'All data cleared');
  }, [lang, showToast]);

  const cleanDuplicates = useCallback(async () => {
    const nameGroups = {};
    for (const p of people) {
      const n = (p.name || '').trim().toLowerCase();
      if (!n) continue;
      if (!nameGroups[n]) nameGroups[n] = [];
      nameGroups[n].push(p);
    }
    
    let deletedIds = [];
    let updatedPeople = [];
    
    for (const n in nameGroups) {
      const group = nameGroups[n];
      if (group.length === 1) {
        updatedPeople.push(group[0]);
      } else {
        group.sort((a, b) => {
           const scoreA = Object.keys(a).length + (a.interactions?.length || 0) + (a.tags?.length || 0);
           const scoreB = Object.keys(b).length + (b.interactions?.length || 0) + (b.tags?.length || 0);
           return scoreB - scoreA;
        });
        const primary = { ...group[0] };
        let allInteractions = [...(primary.interactions || [])];
        let allTags = [...(primary.tags || [])];
        for (let i = 1; i < group.length; i++) {
           deletedIds.push(group[i].id);
           if (group[i].interactions) allInteractions.push(...group[i].interactions);
           if (group[i].tags) allTags.push(...group[i].tags);
        }
        primary.interactions = [...new Map(allInteractions.map(item => [item.id, item])).values()];
        primary.tags = [...new Map(allTags.map(item => [item.id, item])).values()];
        updatedPeople.push(primary);
      }
    }
    
    if (deletedIds.length > 0) {
       setPeople(updatedPeople);
       for (const id of deletedIds) {
          try { await apiPeople.delete(id); } catch {}
       }
       showToast(`✅ Đã gộp và làm sạch ${deletedIds.length} dữ liệu bị trùng tên`);
    } else {
       showToast(`✅ Dữ liệu của bạn rất sạch, không có ai bị trùng tên!`);
    }
  }, [people, showToast]);

  // Auth
  const signInWithGoogle = useCallback(async () => {
    try {
      await fbSignInGoogle();
    } catch (e) {
      console.error('🔥 Google Sign-In error:', e.code, e.message);
      const msg = lang === 'vi'
        ? (e.code === 'auth/operation-not-allowed'
          ? 'Google Sign-In chưa được bật trong Firebase Console'
          : e.code === 'auth/unauthorized-domain'
          ? 'Domain chưa được cho phép trong Firebase Auth'
          : 'Đăng nhập thất bại: ' + e.message)
        : 'Login failed: ' + e.message;
      showToast(msg);
      throw e;
    }
  }, [showToast, lang]);

  const signInWithEmail = useCallback(async (email, password) => {
    try {
      await fbSignInEmail(email, password);
    } catch (e) {
      showToast((lang === 'vi' ? 'Đăng nhập thất bại: ' : 'Login failed: ') + e.message);
      throw e;
    }
  }, [showToast, lang]);

  const signUpWithEmail = useCallback(async (email, password) => {
    try {
      await fbSignUpEmail(email, password);
    } catch (e) {
      showToast((lang === 'vi' ? 'Đăng ký thất bại: ' : 'Signup failed: ') + e.message);
      throw e;
    }
  }, [showToast, lang]);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut();
      setUser(null);
      showToast('Đã đăng xuất');
    } catch { showToast('Sign out failed'); }
  }, [showToast]);

  const value = {
    people, setPeople, events, memories, places, tags, settings, activeTab, toast, lang,
    lifeScore, stats, suggestions, scoreHistory, user, isLoggedIn, isSyncing, userRole,
    groups,
    setActiveTab, toggleLang, setSettings, showToast,
    addPerson, updatePerson, deletePerson, addInteraction,
    addEvent, updateEvent, deleteEvent,
    addMemory, updateMemory, deleteMemory,
    addPlace, updatePlace, deletePlace,
    addTag, updateTag, deleteTag,
    addGroup, updateGroup, deleteGroup,
    exportData, importData, clearAllData, cleanDuplicates,
    signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
    apiDataHub, apiAuth,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
