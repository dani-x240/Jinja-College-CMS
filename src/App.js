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
import ReportsHub from './pages/ReportsHub';
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
import { parseAssignedClasses } from './utils/classAssignments';
import { runAutoSubmissionPipeline } from './utils/autoSubmission';
import { loadAppUpdatingState, isVersionBelowMinimum } from './utils/appConfig';
import { APP_VERSION } from './utils/appVersion';
import { Menu } from 'lucide-react';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [securitySetupData, setSecuritySetupData] = useState(createEmptySecurityQuestionState());
  const [securitySetupSaving, setSecuritySetupSaving] = useState(false);
  const [securitySetupError, setSecuritySetupError] = useState('');
  const [securityQuestionsEnabled, setSecurityQuestionsEnabled] = useState(false);
  const [passwordResetRequired, setPasswordResetRequired] = useState(false);
  const [passwordResetData, setPasswordResetData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordResetSaving, setPasswordResetSaving] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState('');
  const [appUpdatingState, setAppUpdatingState] = useState({
    loading: true,
    enabled: false,
    message: 'School system is updating... Please wait a moment.',
    forceUpdate: false,
    minimumSupportedVersion: '0.0.0',
    updateDownloadUrl: '',
    updateRequiredMessage: 'A new version of this app is available. Please update to continue.'
  });

  const refreshAppUpdating = async () => {
    try {
      const state = await loadAppUpdatingState();
      setAppUpdatingState({ loading: false, ...state });
    } catch (error) {
      console.error('Failed to load app updating state:', error);
      setAppUpdatingState((prev) => ({ ...prev, loading: false }));
    }
  };

  const refreshSecurityQuestionAvailability = async () => {
    const isAvailable = await checkSecurityQuestionSchemaAvailability(supabase);
    setSecurityQuestionsEnabled(isAvailable);
    return isAvailable;
  };

  useEffect(() => {
    const initializeApp = async () => {
      const savedTheme = localStorage.getItem('themeMode') || 'light';
      document.body.dataset.theme = savedTheme;

      await refreshAppUpdating();
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
    const handleWindowFocus = () => {
      refreshAppUpdating();
      refreshSecurityQuestionAvailability();

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser?.id) {
          refreshUserData(parsedUser.id);
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || user.role !== 'admin') return;

    const refreshTimer = setInterval(() => {
      refreshUserData(user.id);
    }, 60000);

    return () => clearInterval(refreshTimer);
  }, [user?.id, user?.role]);

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      refreshAppUpdating();
    }, 60000);

    return () => clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const runPipeline = async () => {
      try {
        await runAutoSubmissionPipeline();
      } catch (error) {
        console.error('Auto submission pipeline failed:', error);
      }
    };

    runPipeline();
    const autoSubmissionTimer = setInterval(runPipeline, 3 * 60 * 1000);

    return () => clearInterval(autoSubmissionTimer);
  }, [user?.id]);

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
    setSelectedClassFilter('');
  };

  const handleNavigateWithClassFilter = (targetTab, className) => {
    setSelectedClassFilter(className || '');
    setActiveTab(targetTab);
  };

  const requiresSecuritySetup = securityQuestionsEnabled && user && !hasSecurityQuestionsConfigured(user);

  useEffect(() => {
    if (requiresSecuritySetup) {
      setSecuritySetupData(createEmptySecurityQuestionState());
      setSecuritySetupError('');
    }
  }, [requiresSecuritySetup, user?.id]);

  useEffect(() => {
    if (user) {
      const requiresReset = localStorage.getItem('passwordResetRequired') === 'true';
      setPasswordResetRequired(requiresReset);

      if (requiresReset) {
        setPasswordResetData({ newPassword: '', confirmPassword: '' });
        setPasswordResetError('');
      }
    }
  }, [user?.id]);

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();

    if (!passwordResetData.newPassword || !passwordResetData.confirmPassword) {
      setPasswordResetError('Please enter and confirm your new password.');
      return;
    }

    if (passwordResetData.newPassword.length < 6) {
      setPasswordResetError('New password must be at least 6 characters.');
      return;
    }

    if (passwordResetData.newPassword !== passwordResetData.confirmPassword) {
      setPasswordResetError('Passwords do not match.');
      return;
    }

    setPasswordResetSaving(true);
    setPasswordResetError('');

    const { error } = await supabase
      .from('teachers')
      .update({ password: passwordResetData.newPassword })
      .eq('id', user.id);

    setPasswordResetSaving(false);

    if (error) {
      setPasswordResetError(error.message || 'Failed to update password.');
      return;
    }

    localStorage.removeItem('passwordResetRequired');
    setPasswordResetRequired(false);
  };

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

  // Do not block the whole UI while checking remote config —
  // show normal app immediately.
  // Maintenance or forced-update screens will still render once `appUpdatingState` is loaded.

  if (appUpdatingState.enabled) {
    return (
      <div className="startup-screen startup-screen-maintenance">
        <div className="startup-card maintenance-card">
          <div className="maintenance-badge">Maintenance Mode</div>
          <h1>School System Updating</h1>
          <p>{appUpdatingState.message}</p>
          <button
            type="button"
            onClick={refreshAppUpdating}
            className="btn-primary"
            style={{ margin: '0 auto', justifyContent: 'center', minWidth: '170px' }}
          >
            Check Again
          </button>
        </div>
      </div>
    );
  }

  const needsUpdate = appUpdatingState.forceUpdate
    && isVersionBelowMinimum(APP_VERSION, appUpdatingState.minimumSupportedVersion);

  if (needsUpdate) {
    const handleDownloadUpdate = () => {
      if (!appUpdatingState.updateDownloadUrl) return;
      window.open(appUpdatingState.updateDownloadUrl, '_blank', 'noopener,noreferrer');
    };

    return (
      <div className="startup-screen startup-screen-update-required">
        <div className="startup-card update-required-card">
          <div className="maintenance-badge">Update Required</div>
          <h1>New Version Available</h1>
          <p>{appUpdatingState.updateRequiredMessage}</p>
          <p style={{ fontSize: '14px' }}>
            Current version: <strong>{APP_VERSION}</strong><br />
            Required version: <strong>{appUpdatingState.minimumSupportedVersion}</strong>
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={refreshAppUpdating}
              className="btn"
              style={{ minWidth: '150px' }}
            >
              Check Again
            </button>
            <button
              type="button"
              onClick={handleDownloadUpdate}
              className="btn-primary"
              style={{ minWidth: '180px', justifyContent: 'center' }}
              disabled={!appUpdatingState.updateDownloadUrl}
            >
              Download Update
            </button>
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
        return <Attendance user={user} selectedClassFilter={selectedClassFilter} />;
      case 'teachers':
        return <Teachers user={user} />;
      case 'classes':
        return <Classes onNavigateWithClassFilter={handleNavigateWithClassFilter} />;
      case 'duty-management':
        return <DutyManagement />;
      case 'submit-report':
        return <SubmitReport user={user} />;
      case 'my-reports':
        return <MyReports user={user} />;
      case 'my-class':
        return <MyClass user={user} />;
      case 'sms':
        return <SMSPage user={user} selectedClassFilter={selectedClassFilter} />;
      case 'class-reports':
        return <ClassReports user={user} />;
      case 'duty':
        return <DutyDashboard user={user} />;
      case 'manage-students':
        return <Students user={user} />;
      case 'reports':
        return user.role === 'admin'
          ? <AllReports selectedClassFilter={selectedClassFilter} />
          : <ReportsHub user={user} />;
      case 'settings':
        return <Settings user={user} onUserRefresh={refreshUserData} />;
      default:
        return <Dashboard user={user} />;
    }
  };

  const classTeacherAssignments = parseAssignedClasses(user.class_teacher_assigned);
  const userRoleLabel = user.role === 'admin'
    ? 'Administrator'
    : classTeacherAssignments.length > 0
      ? 'Class Teacher'
      : 'Teacher';

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
                {userRoleLabel}
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

      {passwordResetRequired && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.74)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 3100 }}>
          <div style={{ width: '100%', maxWidth: '460px', background: '#ffffff', borderRadius: '18px', padding: '24px', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-dark)' }}>Set A New Password</h2>
            <p style={{ margin: '10px 0 16px', color: 'var(--text-gray)', lineHeight: '1.6' }}>
              You signed in using password recovery. Please set a new password to continue.
            </p>

            {passwordResetError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
                {passwordResetError}
              </div>
            )}

            <form onSubmit={handlePasswordResetSubmit} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordResetData.newPassword}
                  onChange={(e) => setPasswordResetData({ ...passwordResetData, newPassword: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordResetData.confirmPassword}
                  onChange={(e) => setPasswordResetData({ ...passwordResetData, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" disabled={passwordResetSaving} style={{ justifyContent: 'center' }}>
                {passwordResetSaving ? 'Saving...' : 'Save New Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
