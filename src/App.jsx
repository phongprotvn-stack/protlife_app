import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from './contexts/AppContext';
import { Heart, Users, CalendarHeart, BookHeart, User } from 'lucide-react';
import { t } from './i18n';
import Dashboard from './screens/Dashboard';
import People from './screens/People';
import Events from './screens/Events';
import Memories from './screens/Memories';
import Settings from './screens/Settings';
import PersonDetail from './screens/PersonDetail';
import Places from './screens/Places';
import Timeline from './screens/Timeline';

const navItems = [
  { id: 'dashboard', Icon: Heart, labelKey: 'nav.dashboard' },
  { id: 'people', Icon: Users, labelKey: 'nav.people' },
  { id: 'events', Icon: CalendarHeart, labelKey: 'nav.events' },
  { id: 'memories', Icon: BookHeart, labelKey: 'nav.memories' },
  { id: 'settings', Icon: User, labelKey: 'nav.settings' },
];

export default function App() {
  const { activeTab, setActiveTab, lang, toast, people, events, memories, places, tags,
    addPerson, updatePerson, deletePerson, addInteraction,
    addEvent, updateEvent, deleteEvent,
    addMemory, updateMemory, deleteMemory,
    addPlace, updatePlace, deletePlace,
    groups, addGroup, updateGroup, deleteGroup } = useApp();
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [showPlaces, setShowPlaces] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const navStackRef = useRef([]);       // track screen stack for back button
  const isPopRef = useRef(false);       // prevent pushState during popstate

  const showPerson = (id) => {
    navStackRef.current = [...navStackRef.current, { type: 'close-person' }];
    setSelectedPersonId(id);
    setShowNav(false);
    window.history.pushState({ screen: 'person', id }, '');
  };

  const hidePerson = () => {
    setSelectedPersonId(null);
    setShowNav(true);
  };

  const openPlaces = () => {
    navStackRef.current = [...navStackRef.current, { type: 'close-places' }];
    setShowPlaces(true);
    setShowNav(false);
    window.history.pushState({ screen: 'places' }, '');
  };

  const closePlaces = () => {
    setShowPlaces(false);
    setShowNav(true);
  };

  const openTimeline = () => {
    navStackRef.current = [...navStackRef.current, { type: 'close-timeline' }];
    setShowTimeline(true);
    setShowNav(false);
    window.history.pushState({ screen: 'timeline' }, '');
  };

  const closeTimeline = () => {
    setShowTimeline(false);
    setShowNav(true);
  };

  // ── Tab change with history ──
  const navigateTab = useCallback((tab) => {
    if (tab !== activeTab) {
      isPopRef.current = false;
      setActiveTab(tab);
      window.history.pushState({ tab }, '');
    }
  }, [activeTab, setActiveTab]);

  // ── Listen to browser back/forward ──
  useEffect(() => {
    const handlePopState = (e) => {
      isPopRef.current = true;
      if (e.state?.tab) {
        setActiveTab(e.state.tab);
      } else if (!e.state || e.state.screen === 'dashboard') {
        // No more history → go to dashboard
        if (selectedPersonId) hidePerson();
        else if (showPlaces) closePlaces();
        else if (showTimeline) closeTimeline();
        else setActiveTab('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    // Seed initial history state
    if (!window.history.state) {
      window.history.replaceState({ tab: 'dashboard' }, '');
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPersonId, showPlaces, showTimeline, setActiveTab]);

  // ── Sync showNav with sub-views ──
  useEffect(() => {
    setShowNav(!selectedPersonId && !showPlaces && !showTimeline);
  }, [selectedPersonId, showPlaces, showTimeline]);

  const renderScreen = () => {
    // Timeline sub-view
    if (showTimeline) {
      return <Timeline onClose={closeTimeline} />;
    }

    // Places sub-view
    if (showPlaces) {
      return <Places places={places} addPlace={addPlace} updatePlace={updatePlace} deletePlace={deletePlace}
        onBack={closePlaces} />;
    }

    // Person detail overlay
    if (selectedPersonId) {
      const person = people.find(p => p.id === selectedPersonId);
      if (person) {
        const personEvents = events.filter(e => (e.peopleIds || []).includes(selectedPersonId));
        const personMemories = memories.filter(m => (m.peopleIds || []).includes(selectedPersonId));
        return (
          <PersonDetail
            person={person}
            events={personEvents}
            memories={personMemories}
            onBack={hidePerson}
            onDelete={() => { deletePerson(selectedPersonId); hidePerson(); }}
            onAddInteraction={(interaction) => addInteraction(selectedPersonId, interaction)}
            people={people}
            places={places}
            groups={groups}
            addGroup={addGroup}
          />
        );
      }
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard people={people} events={events} memories={memories} places={places}
          onShowPlaces={openPlaces}
          onShowTimeline={openTimeline} />;
      case 'people':
        return <People people={people} tags={tags} groups={groups} onSelectPerson={showPerson} addPerson={addPerson} updatePerson={updatePerson} addGroup={addGroup} updateGroup={updateGroup} deleteGroup={deleteGroup} />;
      case 'events':
        return <Events events={events} people={people} places={places} addEvent={addEvent} updateEvent={updateEvent} deleteEvent={deleteEvent} />;
      case 'memories':
        return <Memories memories={memories} people={people} places={places} addMemory={addMemory} updateMemory={updateMemory} deleteMemory={deleteMemory} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard people={people} events={events} memories={memories} places={places}
          onShowPlaces={openPlaces}
          onShowTimeline={openTimeline} />;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F8F8FA', position: 'relative' }}>
      <main style={{ flex: 1, overflow: 'hidden auto', position: 'relative' }}>
        <div className="screen screen-enter">
          {renderScreen()}
        </div>
      </main>

      {showNav && (
        <nav className="floating-nav">
          {navItems.map(({ id, Icon, labelKey }) => {
            const isActive = activeTab === id;
            return (
              <div
                key={id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigateTab(id)}
              >
                <span className="nav-icon">
                  <Icon size={24} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span className="nav-label">{t(labelKey, lang)}</span>
              </div>
            );
          })}
        </nav>
      )}

      {/* Toast */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast || ''}</div>
    </div>
  );
}
