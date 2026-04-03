import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import DutyManagement from './pages/DutyManagement';
import SubmitReport from './pages/SubmitReport';
import MyReports from './pages/MyReports';
import MyClass from './pages/MyClass';
import SMSPage from './pages/SMSPage';
import ClassReports from './pages/ClassReports';
import DutyDashboard from './pages/DutyDashboard';
import AllReports from './pages/AllReports';
import Settings from './pages/Settings';
import { supabase } from './utils/supabase';
import { getTeacherWithAssignments, expireOldDuties } from './utils/teacherUtils';
import {
  buildSecurityQuestionPayload,
  checkSecurityQuestionSchemaAvailability,
  createEmptySecurityQuestionState,
  getSecurityQuestionSchemaMessage,
  hasSecurityQuestionsConfigured,
  isSecurityQuestionSchemaMissing,
  validateSecurityQuestionState
} from './utils/securityQuestions';
import { fetchAppConfig } from './utils/appConfig';
import { CURRENT_APP_VERSION } from './config/appVersion';
import { Menu } from 'lucide-react';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [securitySetupData, setSecuritySetupData] = useState(createEmptySecurityQuestionState());
  const [securitySetupSaving, setSecuritySetupSaving] = useState(false);
  const [securitySetupError, setSecuritySetupError] = useState('');
  const [securityQuestionsEnabled, setSecurityQuestionsEnabled] = useState(false);
  const [appGateState, setAppGateState] = useState('checking'); // 'checking' | 'blocked' | 'ready'
  const [appConfig, setAppConfig] = useState(null);
  const [appGateError, setAppGateError] = useState(null);

  const refreshSecurityQuestionAvailability = async () => {
    const isAvailable = await checkSecurityQuestionSchemaAvailability(supabase);
    setSecurityQuestionsEnabled(isAvailable);
    return isAvailable;
  };

  const checkForcedUpdate = async () => {
    try {
      const config = await fetchAppConfig();
      setAppConfig(config);

      if (!config) {
        // In development, if app_config row doesn't exist, allow the app
        console.warn('App config not found - development mode');
        setAppGateState('ready');
        return true;
      }

      if (config.version === CURRENT_APP_VERSION) {
        setAppGateState('ready');
        return true;
      } else {
        setAppGateState('blocked');
        return false;
      }
    } catch (error) {
      console.error('Version check failed:', error);
      // Allow app in development mode if check fails
      setAppGateError(error.message);
      setAppGateState('ready');
      return true;
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      await checkForcedUpdate();
      await refreshSecurityQuestionAvailability();

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        refreshUserData(userData.id);
      }
    };

    initializeApp();
    expireOldDuties();
  }, []);

  useEffect(() => {
    const handleWindowFocus = async () => {
      await checkForcedUpdate();
      await refreshSecurityQuestionAvailability();
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [appGateState]);

  const refreshUserData = async (userId) => {
    const freshData = await getTeacherWithAssignments(userId);
    if (freshData) {
      setUser(freshData);
      localStorage.setItem('user', JSON.stringify(freshData));
    }
  };

  const handleLogin = async (userData) => {
    // Get fresh data with duty assignments
    const freshData = await getTeacherWithAssignments(userData.id);
    setUser(freshData || userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('dashboard');
  };

  const requiresSecuritySetup = securityQuestionsEnabled && user && !hasSecurityQuestionsConfigured(user);

  useEffect(() => {
    if (requiresSecuritySetup) {
      setSecuritySetupData(createEmptySecurityQuestionState());
      setSecuritySetupError('');
    }
  }, [requiresSecuritySetup, user?.id]);

  const handleSecuritySetupSubmit = async (e) => {
    e.preventDefault();

    if (!securityQuestionsEnabled) {
      setSecuritySetupError(getSecurityQuestionSchemaMessage());
      return;
    }

    const validationError = validateSecurityQuestionState(securitySetupData);

    if (validationError) {
      setSecuritySetupError(validationError);
      return;
    }

    setSecuritySetupSaving(true);
    setSecuritySetupError('');

    const { error } = await supabase
      .from('teachers')
      .update(buildSecurityQuestionPayload(securitySetupData))
      .eq('id', user.id);

    setSecuritySetupSaving(false);

    if (error) {
      setSecuritySetupError(
        isSecurityQuestionSchemaMissing(error)
          ? getSecurityQuestionSchemaMessage()
          : error.message || 'Failed to save your security questions.'
      );
      return;
    }

    await refreshUserData(user.id);
  };

  if (appGateState === 'checking') {
    return (
      <div className="force-update-screen">
        <div className="force-update-card">
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px' }}>Checking for updates...</div>
            <div style={{ fontSize: '14px', color: 'var(--text-gray)' }}>Please wait</div>
          </div>
        </div>
      </div>
    );
  }

  if (appGateState === 'blocked') {
    return (
      <div className="force-update-screen">
        <div className="force-update-card">
          <div className="force-update-badge danger">UPDATE REQUIRED</div>
          <h2 style={{ margin: '20px 0 12px', fontSize: '24px', fontWeight: '700' }}>New Version Available</h2>
          <p style={{ margin: '0 0 24px', color: 'var(--text-gray)', lineHeight: '1.6' }}>
            A new version of the app is available. Please download and install the latest version to continue.
          </p>
          
          <div className="force-update-details">
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-gray)', marginBottom: '4px' }}>Current Version</div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>{CURRENT_APP_VERSION}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-gray)', marginBottom: '4px' }}>Latest Version</div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>{appConfig?.version || 'N/A'}</div>
            </div>
          </div>

          <button
            onClick={() => {
              if (appConfig?.apk_url) {
                window.location.href = appConfig.apk_url;
              }
            }}
            className="force-update-button"
          >
            Download Latest Version
          </button>

          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-gray)', textAlign: 'center' }}>
            You must upgrade to continue using the app.
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
        securityQuestionsEnabled={securityQuestionsEnabled}
        refreshSecurityQuestionAvailability={refreshSecurityQuestionAvailability}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} />;
      case 'students':
        return <Students user={user} />;
      case 'attendance':
        return <Attendance user={user} />;
      case 'teachers':
        return <Teachers />;
      case 'classes':
        return <Classes />;
      case 'duty-management':
        return <DutyManagement />;
      case 'submit-report':
        return <SubmitReport user={user} />;
      case 'my-reports':
        return <MyReports user={user} />;
      case 'my-class':
        return <MyClass user={user} />;
      case 'sms':
        return <SMSPage user={user} />;
      case 'class-reports':
        return <ClassReports user={user} />;
      case 'duty':
        return <DutyDashboard user={user} />;
      case 'manage-students':
        return <Students user={user} />;
      case 'reports':
        return <AllReports />;
      case 'settings':
        return <Settings user={user} onUserRefresh={refreshUserData} />;
      default:
        return <Dashboard user={user} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />
      <div className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '8px' }}>
            <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }}>
              <Menu size={24} color="var(--text-dark)" />
            </button>
            <img src={require('./assets/logo.jpg')} alt="Jinja CMS" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
            <div className="topbar-title">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
            </div>
          </div>
          <div className="user-info">
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-gray)' }}>
                {user.role === 'admin' ? 'Administrator' : 'Teacher'}
              </div>
            </div>
            <div className="user-avatar">
              {user.profile_picture ? (
                <img src={user.profile_picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
          </div>
        </div>
        <div className="content-area">
          {renderContent()}
        </div>
      </div>

      {requiresSecuritySetup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.74)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 3000 }}>
          <div style={{ width: '100%', maxWidth: '560px', background: '#ffffff', borderRadius: '18px', padding: '28px', boxShadow: '0 32px 80px rgba(15, 23, 42, 0.28)' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--text-dark)' }}>Set Recovery Questions</h2>
            <p style={{ margin: '10px 0 20px', color: 'var(--text-gray)', lineHeight: '1.6' }}>
              This account was created before recovery questions were added. Save two answers now before you continue using the system.
            </p>

            {securitySetupError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px' }}>
                {securitySetupError}
              </div>
            )}

            <form onSubmit={handleSecuritySetupSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label className="form-label">Security Question 1</label>
                <select
                  className="form-input"
                  value={securitySetupData.securityQuestion1}
                  onChange={(e) => setSecuritySetupData({ ...securitySetupData, securityQuestion1: e.target.value })}
                  required
                >
                  <option value="">Select a question</option>
                  {[
                    'What was the name of your first school?',
                    'What is your mother\'s maiden name?',
                    'What was the name of your childhood best friend?',
                    'What town or village were you born in?',
                    'What is the name of your favorite teacher?',
                    'What was your first phone number?',
                    'What is the first name of your oldest sibling?'
                  ].map((question) => (
                    <option key={question} value={question}>{question}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Answer 1</label>
                <input
                  className="form-input"
                  value={securitySetupData.securityAnswer1}
                  onChange={(e) => setSecuritySetupData({ ...securitySetupData, securityAnswer1: e.target.value })}
                  placeholder="Enter your answer"
                  required
                />
              </div>

              <div>
                <label className="form-label">Security Question 2</label>
                <select
                  className="form-input"
                  value={securitySetupData.securityQuestion2}
                  onChange={(e) => setSecuritySetupData({ ...securitySetupData, securityQuestion2: e.target.value })}
                  required
                >
                  <option value="">Select a different question</option>
                  {[
                    'What was the name of your first school?',
                    'What is your mother\'s maiden name?',
                    'What was the name of your childhood best friend?',
                    'What town or village were you born in?',
                    'What is the name of your favorite teacher?',
                    'What was your first phone number?',
                    'What is the first name of your oldest sibling?'
                  ].map((question) => (
                    <option key={question} value={question}>{question}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Answer 2</label>
                <input
                  className="form-input"
                  value={securitySetupData.securityAnswer2}
                  onChange={(e) => setSecuritySetupData({ ...securitySetupData, securityAnswer2: e.target.value })}
                  placeholder="Enter your answer"
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={securitySetupSaving} style={{ justifyContent: 'center' }}>
                {securitySetupSaving ? 'Saving Questions...' : 'Save And Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
