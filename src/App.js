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
import { getTeacherWithAssignments, expireOldDuties } from './utils/teacherUtils';
import { Menu, Moon, Sun } from 'lucide-react';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      refreshUserData(userData.id);
    }
    // Auto-expire duties every time app loads
    expireOldDuties();
  }, []);

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

  if (!user) {
    return <Login onLogin={handleLogin} />;
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
      case 'duty-management':
        return (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-gray)' }}>
            Duty Management feature coming soon...
          </div>
        );
      case 'reports':
        return <AllReports />;
      case 'settings':
        return <Settings user={user} />;
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
            <button
              className="dark-mode-btn"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
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
    </div>
  );
}

export default App;
