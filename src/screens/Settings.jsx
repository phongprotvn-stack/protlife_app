import { useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { Globe, Download, Upload, Trash2, Info, ChevronRight, Cloud, CloudOff, RefreshCw, Database, Shield, UserCheck } from 'lucide-react';
import { t } from '../i18n';
import DataHubModal from '../components/DataHubModal.jsx';
import ReportPage from './ReportPage.jsx';

export default function Settings() {
  const { settings, lang, toggleLang, exportData, importData, clearAllData, cleanDuplicates, user, isLoggedIn, isSyncing, userRole, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, showToast, people, events, memories, places } = useApp();
  const [authMode, setAuthMode] = useState('google');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [hubModal, setHubModal] = useState(null); // null | 'import' | 'export' | 'report'
  const [reportPage, setReportPage] = useState(null); // null | template object

  const handleEmailAuth = async () => {
    try {
      if (isSignUp) await signUpWithEmail(authEmail, authPass);
      else await signInWithEmail(authEmail, authPass);
      setAuthEmail('');
      setAuthPass('');
    } catch {}
  };

  const handleGenerateReport = (tmpl) => {
    setHubModal(null);
    setReportPage(tmpl);
  };

  // If report page is active, show it full-screen
  if (reportPage) {
    return (
      <ReportPage
        people={people}
        events={events}
        memories={memories}
        places={places}
        lang={lang}
        onClose={() => setReportPage(null)}
      />
    );
  }

  const menuSections = [
    {
      title: t('settings.appInfo', lang),
      items: [
        { icon: Info, color: '#8B5CF6', label: t('settings.about', lang), desc: 'v2.0.0' },
      ],
    },
  ];

  return (
    <div style={{ padding: 'var(--space-page-x)' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{t('settings.title', lang)}</div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 24, marginBottom: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 24,
          background: 'var(--grad-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: 'white', margin: '0 auto 12px',
        }}>
          {isLoggedIn ? (user?.displayName || user?.email || 'P')[0].toUpperCase() : 'P'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{isLoggedIn ? (user?.displayName || user?.email) : 'PROT'}</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>{t('app.tagline', lang)}</div>
      </div>

      {/* Auth Section */}
      <div style={{ marginBottom: 20 }}>
        <div className="title" style={{ marginBottom: 12 }}>{isLoggedIn ? '☁️' : '🔐'} {t('settings.login', lang)}</div>
        {isLoggedIn ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 16, background: 'var(--grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{user?.displayName || user?.email}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {isSyncing ? `🔄 ${t('settings.syncing', lang)}` : `☁️ ${t('settings.syncStatus', lang)}`}
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12, color: '#E6002D' }}
                onClick={signOut}>
                {t('settings.signOut', lang)}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div style={{ marginBottom: 12 }}>
              {authMode === 'email' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input className="input-pill" type="email" placeholder={t('settings.email', lang)}
                    value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                  <input className="input-pill" type="password" placeholder={t('settings.password', lang)}
                    value={authPass} onChange={e => setAuthPass(e.target.value)} />
                  <button className="btn-primary" onClick={handleEmailAuth} disabled={!authEmail || !authPass}>
                    {isSignUp ? t('settings.signUp', lang) : t('settings.login', lang)}
                  </button>
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }}
                    onClick={() => setIsSignUp(!isSignUp)}>
                    {isSignUp ? `${t('settings.login', lang)} →` : `${t('settings.noAccount', lang)} ${t('settings.signUp', lang)} →`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
                  </div>
                </div>
              ) : null}
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={signInWithGoogle}>
                Google {t('settings.login', lang)}
              </button>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }}
                  onClick={() => setAuthMode(authMode === 'email' ? 'google' : 'email')}>
                  {authMode === 'email' ? t('settings.signInGoogle', lang) : t('settings.signInEmail', lang)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Language */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={18} color="#9CA3AF" /> {t('settings.language', lang)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className={`chip ${lang === 'vi' ? 'active' : ''}`}
            style={{ flex: 1, justifyContent: 'center', padding: '12px 0' }}
            onClick={() => { if (lang !== 'vi') toggleLang(); }}>
            🇻🇳 {t('settings.vietnamese', lang)}
          </div>
          <div className={`chip ${lang === 'en' ? 'active' : ''}`}
            style={{ flex: 1, justifyContent: 'center', padding: '12px 0' }}
            onClick={() => { if (lang !== 'en') toggleLang(); }}>
            🇺🇸 {t('settings.english', lang)}
          </div>
        </div>
      </div>

      {/* Cloud Sync Status */}
      <div className="card" style={{ marginBottom: 20, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        {isLoggedIn ? (
          <><Cloud size={18} color="#10B981" /> <span style={{ fontSize: 13, color: '#6B7280' }}>{t('settings.syncStatus', lang)}</span></>
        ) : (
          <><CloudOff size={18} color="#9CA3AF" /> <span style={{ fontSize: 13, color: '#9CA3AF' }}>{t('settings.notSynced', lang)}</span></>
        )}
        {isSyncing && <RefreshCw size={14} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />}
      </div>

      {/* RBAC Role Info */}
      <div className="card" style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={16} color="#8B5CF6" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>RBAC Role</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            {userRole ? (
              <><UserCheck size={14} color="#10B981" style={{ verticalAlign: 'middle', marginRight: 4 }} />
              <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#10B981' }}>{userRole}</span></>
            ) : (
              <span style={{ color: '#9CA3AF' }}>Guest (Public) — read only</span>
            )}
          </div>
          {userRole === 'admin' && (
            <span style={{ fontSize: 11, color: '#E6002D', fontWeight: 700 }}>⭐ Owner</span>
          )}
        </div>
      </div>

      {/* Data Hub Connectors */}
      <div style={{ marginBottom: 20 }}>
        <div className="title" style={{ marginBottom: 12 }}>📦 Data Hub</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { icon: Database, color: '#059669', label: 'Import Data', desc: 'Google Sheets, JSON, Google Docs', mode: 'import' },
            { icon: Database, color: '#2563EB', label: 'Export Data', desc: 'JSON dump, CSV', mode: 'export' },
            { icon: Database, color: '#7C3AED', label: 'Generate Report', desc: 'PDF, Excel, Word, Google', mode: 'report' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="action-field" onClick={() => setHubModal(item.mode)}
                style={{ padding: '16px var(--space-card-inner)', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
                <div className="af-label">
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={item.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.desc}</div>
                  </div>
                </div>
                <ChevronRight size={18} color="#D1D5DB" />
              </div>
            );
          })}
          {/* Divider & local actions */}
          <div style={{ height: 1, background: '#F3F4F6', margin: '0 16px' }} />
          <div className="action-field" onClick={() => {
            if (confirm(lang === 'vi' ? 'Bạn có chắc chắn muốn quét và gộp các dữ liệu bị trùng tên không?' : 'Merge all duplicate names?')) cleanDuplicates();
          }} style={{ padding: '16px var(--space-card-inner)', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
            <div className="af-label">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F59E0B15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RefreshCw size={16} color="#F59E0B" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{lang === 'vi' ? 'Làm sạch dữ liệu trùng' : 'Clean Duplicates'}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{lang === 'vi' ? 'Gộp những người có cùng tên' : 'Merge people with same name'}</div>
              </div>
            </div>
            <ChevronRight size={18} color="#D1D5DB" />
          </div>

          <div className="action-field" onClick={() => {
            if (confirm(lang === 'vi' ? 'Xoá toàn bộ dữ liệu? Không thể hoàn tác.' : 'Clear all local data? This cannot be undone.')) clearAllData();
          }} style={{ padding: '16px var(--space-card-inner)', cursor: 'pointer' }}>
            <div className="af-label">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#E6002D15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={16} color="#E6002D" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{lang === 'vi' ? 'Xoá tất cả dữ liệu' : 'Clear All Data'}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{lang === 'vi' ? 'Làm trống dữ liệu cục bộ' : 'Reset local data'}</div>
              </div>
            </div>
            <ChevronRight size={18} color="#D1D5DB" />
          </div>
        </div>
      </div>

      {/* Data Hub Modal */}
      {hubModal && <DataHubModal mode={hubModal} onClose={() => setHubModal(null)} onGenerateReport={handleGenerateReport} />}

      {/* App Info */}
      <div style={{ marginBottom: 20 }}>
        <div className="title" style={{ marginBottom: 12 }}>{t('settings.appInfo', lang)}</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="action-field" style={{ padding: '16px var(--space-card-inner)' }}>
            <div className="af-label">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#8B5CF615', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Info size={16} color="#8B5CF6" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t('settings.about', lang)}</div>
            </div>
            <div className="af-value" style={{ fontSize: 12 }}>v2.0.0</div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0', color: '#D1D5DB', fontSize: 12, fontWeight: 600 }}>
        🧬 PROT SPHERE v2.0.0
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}
