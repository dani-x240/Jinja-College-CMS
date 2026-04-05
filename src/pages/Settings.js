import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Settings as SettingsIcon, User, Lock, Save, Upload, X, School, Calendar, MessageSquare, FileText, Shield, AlertTriangle } from 'lucide-react';
import { getDefaultSettingsState, loadSystemSettings, saveSystemSettings } from '../utils/systemSettings';
import {
  SECURITY_QUESTIONS,
  createEmptySecurityQuestionState,
  validateSecurityQuestionState,
  buildSecurityQuestionPayload,
  checkSecurityQuestionSchemaAvailability,
  isSecurityQuestionSchemaMissing,
  getSecurityQuestionSchemaMessage
} from '../utils/securityQuestions';

export default function Settings({ user, onUserRefresh }) {
  const isAdmin = user.role === 'admin';
  const shouldUseCompactSettingsNav = () => {
    if (typeof window === 'undefined') return false;
    const isNarrowViewport = window.innerWidth <= 900;
    const isTouchLikeViewport = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return isNarrowViewport || isTouchLikeViewport;
  };
  const defaultSettingsState = getDefaultSettingsState();
  const [isCompactSettingsNav, setIsCompactSettingsNav] = useState(
    () => shouldUseCompactSettingsNav()
  );
  const [activeTab, setActiveTab] = useState('admin-profile');
  const [formData, setFormData] = useState({
    name: user.name || '',
    phone: user.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    ...defaultSettingsState
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [profilePictureSupported, setProfilePictureSupported] = useState(true);
  const [removeProfilePictureRequested, setRemoveProfilePictureRequested] = useState(false);
  const [resetMode, setResetMode] = useState('teachers_except_me');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState(createEmptySecurityQuestionState());
  const [recoveryQuestionsEnabled, setRecoveryQuestionsEnabled] = useState(false);
  const [savingRecovery, setSavingRecovery] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkProfilePictureSupport();
    checkRecoveryQuestionsSupport();
    if (isAdmin) {
      loadSavedSettings();
    }
  }, []);

  useEffect(() => {
    setRecoveryForm({
      securityQuestion1: user.security_question_1 || '',
      securityAnswer1: '',
      securityQuestion2: user.security_question_2 || '',
      securityAnswer2: ''
    });
  }, [user?.id, user?.security_question_1, user?.security_question_2]);

  const loadSavedSettings = async () => {
    try {
      const loadedSettings = await loadSystemSettings();
      setFormData((previous) => ({
        ...previous,
        ...loadedSettings
      }));
    } catch (error) {
      setMessage('⚠️ Could not load saved settings right now. Using default settings for now.');
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const tabs = [
    { id: 'admin-profile', label: 'Admin Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: SettingsIcon },
    { id: 'school', label: 'School Profile', icon: School },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'sms', label: 'SMS & Notifications', icon: MessageSquare },
    { id: 'reporting', label: 'Reporting', icon: FileText },
    { id: 'duty', label: 'Duty Management', icon: Shield },
    { id: 'reset-data', label: 'Reset Data', icon: AlertTriangle }
  ];

  const teacherTabs = [
    { id: 'appearance', label: 'Appearance', icon: SettingsIcon }
  ];

  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'light');
  const currentProfilePicture = profilePicturePreview || (removeProfilePictureRequested ? null : user.profile_picture);

  useEffect(() => {
    document.body.dataset.theme = themeMode;
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!isAdmin) {
      setActiveTab('appearance');
    }
  }, [isAdmin]);

  useEffect(() => {
    const updateCompactState = () => {
      setIsCompactSettingsNav(shouldUseCompactSettingsNav());
    };

    updateCompactState();
    window.addEventListener('resize', updateCompactState);
    return () => window.removeEventListener('resize', updateCompactState);
  }, []);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const isMissingProfilePictureColumnError = (error) => {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes('profile_picture') && (text.includes('column') || text.includes('schema cache'));
  };

  const checkProfilePictureSupport = async () => {
    const { error } = await supabase
      .schema('public')
      .from('teachers')
      .select('profile_picture')
      .limit(1);

    if (error && isMissingProfilePictureColumnError(error)) {
      setProfilePictureSupported(false);
    }
  };

  const checkRecoveryQuestionsSupport = async () => {
    const enabled = await checkSecurityQuestionSchemaAvailability(supabase);
    setRecoveryQuestionsEnabled(enabled);
  };

  const saveGeneralSettings = async () => {
    setLoading(true);
    try {
      await saveSystemSettings(formData, user.id);
      setMessage('✅ Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      const messageText = `${error?.message || ''}`.toLowerCase();
      if (messageText.includes('settings storage is not set up yet')) {
        setMessage('⚠️ Settings storage is not ready yet. Please run database_settings.sql, then try saving again.');
      } else {
        setMessage('❌ Failed to save settings. Please try again.');
      }
    }
    setLoading(false);
  };

  const handleProfilePictureChange = (e) => {
    if (!profilePictureSupported) {
      setMessage('⚠️ Profile photo is not enabled in this database yet. Run add_profile_picture.sql (or add_lesson_reports_table.sql) in Supabase SQL Editor.');
      setTimeout(() => setMessage(''), 4000);
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setMessage('❌ Please select a valid image file (JPG, PNG, or GIF)');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('❌ File too large. Maximum size is 5MB');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setProfilePicture(file);
    setRemoveProfilePictureRequested(false);
    setProfilePicturePreview(URL.createObjectURL(file));
    setMessage('');
  };

  const removeProfilePicture = async () => {
    setProfilePicture(null);
    setProfilePicturePreview(null);
    setRemoveProfilePictureRequested(true);

    if (!profilePictureSupported) {
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('teachers')
      .update({ profile_picture: null })
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      if (isMissingProfilePictureColumnError(error)) {
        setProfilePictureSupported(false);
        setMessage('⚠️ Profile photo column is not enabled in this database yet.');
      } else {
        setMessage(`❌ Failed to remove profile photo: ${error.message || 'Unknown error'}`);
      }
      return;
    }

    const updatedUser = { ...user, profile_picture: null };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    if (onUserRefresh) {
      await onUserRefresh(user.id);
    }
    setMessage('✅ Profile photo removed successfully!');
    setTimeout(() => setMessage(''), 2500);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const updateData = { 
        name: formData.name, 
        phone: formData.phone 
      };

      if (removeProfilePictureRequested) {
        updateData.profile_picture = null;
      }
      
      // If profile picture selected, convert to base64 and store in database
      if (profilePicture && profilePictureSupported) {
        const reader = new FileReader();
        reader.onerror = () => {
          setMessage('❌ Error reading image file');
          setLoading(false);
        };
        reader.onloadend = async () => {
          try {
            updateData.profile_picture = reader.result;
            await saveProfile(updateData);
          } catch (err) {
            setMessage('❌ Error updating profile: ' + (err.message || 'Unknown error'));
            setLoading(false);
          }
        };
        reader.readAsDataURL(profilePicture);
      } else {
        await saveProfile(updateData);
      }
    } catch (error) {
      setMessage('❌ Error updating profile: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const saveProfile = async (updateData) => {
    try {
      const { error } = await supabase
        .from('teachers')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        if (isMissingProfilePictureColumnError(error)) {
          const fallbackData = { ...updateData };
          delete fallbackData.profile_picture;
          setProfilePictureSupported(false);

          const { error: fallbackError } = await supabase
            .from('teachers')
            .update(fallbackData)
            .eq('id', user.id);

          if (fallbackError) {
            throw new Error(fallbackError.message || 'Database update failed');
          }

          setMessage('✅ Profile updated. Photo column is not available yet, so photo was skipped.');
          const updatedUser = { ...user, ...fallbackData };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setTimeout(() => {
            setMessage('');
            window.location.reload();
          }, 1800);
          setLoading(false);
          return;
        }

        throw new Error(error.message || 'Database update failed');
      }

      setMessage('✅ Profile updated successfully!');
      const updatedUser = { ...user, ...updateData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (onUserRefresh) {
        await onUserRefresh(user.id);
      }
      setTimeout(() => {
        setMessage('');
        window.location.reload();
      }, 1500);
      setRemoveProfilePictureRequested(false);
      setLoading(false);
    } catch (err) {
      throw err;
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!formData.currentPassword || !formData.newPassword) {
      setMessage('Please fill all password fields');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      setMessage('New password must be at least 6 characters');
      return;
    }

    setLoading(true);

    // Verify current password
    const { data: userData } = await supabase
      .from('teachers')
      .select('password')
      .eq('id', user.id)
      .single();

    if (userData.password !== formData.currentPassword) {
      setMessage('Current password is incorrect');
      setLoading(false);
      return;
    }

    // Update password
    const { error } = await supabase
      .from('teachers')
      .update({ password: formData.newPassword })
      .eq('id', user.id);

    setLoading(false);
    if (error) {
      setMessage('Error changing password');
    } else {
      setMessage('Password changed successfully!');
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRecoveryChange = (field, value) => {
    setRecoveryForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSaveRecoveryQuestions = async (e) => {
    e.preventDefault();

    if (!recoveryQuestionsEnabled) {
      setMessage(`⚠️ ${getSecurityQuestionSchemaMessage()}`);
      return;
    }

    const validationError = validateSecurityQuestionState(recoveryForm);
    if (validationError) {
      setMessage(`❌ ${validationError}`);
      return;
    }

    setSavingRecovery(true);

    const payload = buildSecurityQuestionPayload(recoveryForm);
    const { error } = await supabase.from('teachers').update(payload).eq('id', user.id);

    setSavingRecovery(false);

    if (error) {
      setMessage(
        isSecurityQuestionSchemaMissing(error)
          ? `⚠️ ${getSecurityQuestionSchemaMessage()}`
          : `❌ Failed to save recovery questions: ${error.message || 'Unknown error'}`
      );
      return;
    }

    const updatedUser = {
      ...user,
      security_question_1: payload.security_question_1,
      security_answer_1: payload.security_answer_1,
      security_question_2: payload.security_question_2,
      security_answer_2: payload.security_answer_2,
      security_questions_completed_at: payload.security_questions_completed_at
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    if (onUserRefresh) {
      await onUserRefresh(user.id);
    }

    setRecoveryForm((previous) => ({
      ...previous,
      securityAnswer1: '',
      securityAnswer2: ''
    }));
    setMessage('✅ Recovery questions saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  const renderRecoveryQuestions = () => (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Lock size={24} style={{ color: 'var(--primary)' }} />
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Forgot Password Recovery Questions</h2>
      </div>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-gray)' }}>
        Update your recovery questions and answers for forgot password sign-in.
      </p>

      {!recoveryQuestionsEnabled ? (
        <div style={{ padding: '12px', borderRadius: '8px', background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }}>
          {getSecurityQuestionSchemaMessage()}
        </div>
      ) : (
        <form onSubmit={handleSaveRecoveryQuestions} style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label className="form-label">Recovery Question 1</label>
            <select
              className="form-input"
              value={recoveryForm.securityQuestion1}
              onChange={(e) => handleRecoveryChange('securityQuestion1', e.target.value)}
              required
            >
              <option value="">Select question</option>
              {SECURITY_QUESTIONS.map((question) => (
                <option key={question} value={question}>{question}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Answer 1</label>
            <input
              className="form-input"
              value={recoveryForm.securityAnswer1}
              onChange={(e) => handleRecoveryChange('securityAnswer1', e.target.value)}
              placeholder="Enter new answer"
              required
            />
          </div>

          <div>
            <label className="form-label">Recovery Question 2</label>
            <select
              className="form-input"
              value={recoveryForm.securityQuestion2}
              onChange={(e) => handleRecoveryChange('securityQuestion2', e.target.value)}
              required
            >
              <option value="">Select question</option>
              {SECURITY_QUESTIONS.map((question) => (
                <option key={question} value={question}>{question}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Answer 2</label>
            <input
              className="form-input"
              value={recoveryForm.securityAnswer2}
              onChange={(e) => handleRecoveryChange('securityAnswer2', e.target.value)}
              placeholder="Enter new answer"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={savingRecovery} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
            <Save size={18} />
            {savingRecovery ? 'Saving...' : 'Save Recovery Questions'}
          </button>
        </form>
      )}
    </div>
  );

  const renderAdminProfile = () => (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>  
            <User size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Profile Picture</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '150px', height: '150px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border)', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentProfilePicture ? (
                <img src={currentProfilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={60} style={{ color: '#9ca3af' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {profilePictureSupported && (
                <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={18} />
                  Upload Photo
                  <input type="file" accept="image/jpeg,image/png,image/gif" onChange={handleProfilePictureChange} style={{ display: 'none' }} />
                </label>
              )}
              {currentProfilePicture && (
                <button onClick={removeProfilePicture} className="btn-secondary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <X size={18} />
                  {loading ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-gray)', textAlign: 'center' }}>
              {profilePictureSupported
                ? 'Allowed: JPG, PNG, GIF • Max size: 5MB'
                : 'Profile photo storage is not enabled in this database yet.'}
            </div>
            {!profilePictureSupported && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#334155', textAlign: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                Enable it in Supabase SQL Editor with: ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS profile_picture TEXT;
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <User size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Profile Information</h2>
          </div>
          <form onSubmit={handleProfileUpdate}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label className="form-label">Full Name</label>
                <input 
                  className="form-input" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>
              <div>
                <label className="form-label">Phone Number</label>
                <input 
                  className="form-input" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">Staff ID</label>
                <input 
                  className="form-input" 
                  value={user.staff_id} 
                  disabled
                  style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                />
                <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginTop: '4px' }}>
                  Staff ID cannot be changed
                </div>
              </div>
              <div>
                <label className="form-label">Role</label>
                <input 
                  className="form-input" 
                  value={user.role === 'admin' ? 'Administrator' : 'Teacher'} 
                  disabled
                  style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Save size={18} />
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Lock size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Change Password</h2>
          </div>
          <form onSubmit={handlePasswordChange}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label className="form-label">Current Password</label>
                <input 
                  type="password"
                  className="form-input" 
                  value={formData.currentPassword} 
                  onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="form-label">New Password</label>
                <input 
                  type="password"
                  className="form-input" 
                  value={formData.newPassword} 
                  onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div>
                <label className="form-label">Confirm New Password</label>
                <input 
                  type="password"
                  className="form-input" 
                  value={formData.confirmPassword} 
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  placeholder="Confirm new password"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} />
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>

        {renderRecoveryQuestions()}
    </div>
  );

  const renderSchoolProfile = () => (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>School Profile Settings</h2>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div>
          <label className="form-label">School Name</label>
          <input className="form-input" value={formData.schoolName} onChange={(e) => handleChange('schoolName', e.target.value)} />
        </div>
        <div>
          <label className="form-label">School Address</label>
          <input className="form-input" value={formData.schoolAddress} onChange={(e) => handleChange('schoolAddress', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label className="form-label">School Phone</label>
            <input className="form-input" value={formData.schoolPhone} onChange={(e) => handleChange('schoolPhone', e.target.value)} />
          </div>
          <div>
            <label className="form-label">School Email</label>
            <input className="form-input" type="email" value={formData.schoolEmail} onChange={(e) => handleChange('schoolEmail', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="form-label">School Motto</label>
          <input className="form-input" value={formData.schoolMotto} onChange={(e) => handleChange('schoolMotto', e.target.value)} />
        </div>
        <button onClick={saveGeneralSettings} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const renderTeacherAppearance = () => (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Appearance</h2>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <label className="form-label">Theme Mode</label>
          <select className="form-input" value={themeMode} onChange={(e) => setThemeMode(e.target.value)} style={{ maxWidth: '260px' }}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginTop: '8px' }}>
            {isAdmin
              ? 'Set the interface look for this admin session.'
              : 'Teacher settings are limited to personal appearance only.'}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Attendance Settings</h2>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div>
          <label className="form-label">Attendance Marking Window</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <input type="time" className="form-input" value={formData.attendanceWindowStart} onChange={(e) => handleChange('attendanceWindowStart', e.target.value)} />
            <input type="time" className="form-input" value={formData.attendanceWindowEnd} onChange={(e) => handleChange('attendanceWindowEnd', e.target.value)} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginTop: '4px' }}>Teachers can only mark attendance during these hours</div>
        </div>
        <div>
          <label className="form-label">Attendance Categories</label>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px' }}>Green:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" className="form-input" value={formData.greenThreshold} onChange={(e) => handleChange('greenThreshold', e.target.value)} style={{ width: '80px' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-gray)' }}>% and above</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px' }}>Orange:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" className="form-input" value={formData.orangeThreshold} onChange={(e) => handleChange('orangeThreshold', e.target.value)} style={{ width: '80px' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-gray)' }}>% to 89%</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px' }}>Red:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-gray)' }}>Below</span>
                <input type="number" className="form-input" value={formData.redThreshold} onChange={(e) => handleChange('redThreshold', e.target.value)} style={{ width: '80px' }} />
                <span style={{ fontSize: '14px', color: 'var(--text-gray)' }}>%</span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="form-label">Auto-flag Red Students After</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="number" className="form-input" value={formData.consecutiveAbsences} onChange={(e) => handleChange('consecutiveAbsences', e.target.value)} style={{ width: '80px' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-gray)' }}>consecutive absences</span>
          </div>
        </div>
        <button onClick={saveGeneralSettings} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const renderSMS = () => (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>SMS & Notification Settings</h2>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div>
          <label className="form-label">SMS Provider</label>
          <select className="form-input" value={formData.smsProvider} onChange={(e) => handleChange('smsProvider', e.target.value)}>
            <option>Africa's Talking</option>
            <option>Twilio</option>
            <option>Custom</option>
          </select>
        </div>
        <div>
          <label className="form-label">Sender ID</label>
          <input className="form-input" value={formData.senderID} onChange={(e) => handleChange('senderID', e.target.value)} placeholder="e.g., JINJACOL" />
          <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginTop: '4px' }}>This name appears as the SMS sender</div>
        </div>
        <div>
          <label className="form-label">SMS Templates</label>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Absence Alert</label>
              <textarea className="form-input" rows="2" defaultValue="Dear Parent, [Student] was marked absent today at Jinja College." style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>Red Alert</label>
              <textarea className="form-input" rows="2" defaultValue="URGENT: Your child [Student]'s attendance is [Percentage]%. Please contact school." style={{ resize: 'vertical' }} />
            </div>
          </div>
        </div>
        <button onClick={saveGeneralSettings} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const renderReporting = () => (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Reporting Settings</h2>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div>
          <label className="form-label">Weekly Report Day</label>
          <select className="form-input" value={formData.reportDay} onChange={(e) => handleChange('reportDay', e.target.value)}>
            <option>Monday</option>
            <option>Tuesday</option>
            <option>Wednesday</option>
            <option>Thursday</option>
            <option>Friday</option>
          </select>
          <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginTop: '4px' }}>When weekly reports are due</div>
        </div>
        <div>
          <label className="form-label">Report Deadline Time</label>
          <input type="time" className="form-input" value={formData.reportDeadline} onChange={(e) => handleChange('reportDeadline', e.target.value)} />
          <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginTop: '4px' }}>Cutoff time for report submissions</div>
        </div>

        <div style={{ padding: '14px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#f8fafc' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Auto Submission Durations (Days)</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-gray)' }}>
            Admin sets how many days the system waits before automatically forwarding reports through the full chain.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: '12px' }}>
            <div>
              <label className="form-label">Teacher to Class Teacher</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={formData.autoTeacherToClassDays}
                onChange={(e) => handleChange('autoTeacherToClassDays', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Class Teacher to Duty</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={formData.autoClassToDutyDays}
                onChange={(e) => handleChange('autoClassToDutyDays', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Duty to Admin</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={formData.autoDutyToAdminDays}
                onChange={(e) => handleChange('autoDutyToAdminDays', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-gray)' }}>
            Example: 1, 2, 3 means teacher reports are auto-escalated after 1 day, class level after 2 additional days, and duty to admin after 3 more days.
          </div>
        </div>

        <button onClick={saveGeneralSettings} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const renderDuty = () => (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Duty Management Settings</h2>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div>
          <label className="form-label">Default Duty Duration</label>
          <select className="form-input" value={formData.dutyDuration} onChange={(e) => handleChange('dutyDuration', e.target.value)}>
            <option>One Week</option>
            <option>Two Weeks</option>
            <option>One Month</option>
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label className="form-label">Maximum Team Size</label>
            <input type="number" className="form-input" value={formData.maxTeamSize} onChange={(e) => handleChange('maxTeamSize', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Minimum Team Size</label>
            <input type="number" className="form-input" value={formData.minTeamSize} onChange={(e) => handleChange('minTeamSize', e.target.value)} />
          </div>
        </div>
        <button onClick={saveGeneralSettings} className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const resetTableRows = async (tableName) => {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .not('id', 'is', null);

    // Ignore missing-table style errors so reset still works across partial schemas.
    if (error) {
      const text = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      if (text.includes('does not exist') || text.includes('relation') || text.includes('schema cache')) {
        return;
      }
      throw error;
    }
  };

  const handleResetData = async () => {
    if (!resetPassword) {
      setMessage('❌ Enter your admin password to continue.');
      return;
    }

    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      setMessage('❌ Type RESET to confirm this action.');
      return;
    }

    const warningText = resetMode === 'everything'
      ? 'This will delete EVERYTHING, including all teacher accounts (including yours). Continue?'
      : 'This will delete all data and all teachers except your account. Continue?';

    if (!window.confirm(warningText)) {
      return;
    }

    setResetLoading(true);
    setMessage('');

    try {
      const { data: currentAdmin, error: verifyError } = await supabase
        .from('teachers')
        .select('id, password')
        .eq('id', user.id)
        .single();

      if (verifyError || !currentAdmin) {
        setMessage('❌ Could not verify admin account.');
        setResetLoading(false);
        return;
      }

      if (currentAdmin.password !== resetPassword) {
        setMessage('❌ Password is incorrect. Reset cancelled.');
        setResetLoading(false);
        return;
      }

      const tablesToClear = [
        'consolidated_reports',
        'stream_reports',
        'lesson_reports',
        'attendance',
        'sms_logs',
        'duty_assignments',
        'students',
        'streams',
        'classes'
      ];

      for (const tableName of tablesToClear) {
        await resetTableRows(tableName);
      }

      if (resetMode === 'teachers_except_me') {
        const { error: teachersError } = await supabase
          .from('teachers')
          .delete()
          .neq('id', user.id);

        if (teachersError) {
          throw teachersError;
        }

        setMessage('✅ Reset complete: all data removed and all other teachers deleted.');
      } else {
        const { error: teachersError } = await supabase
          .from('teachers')
          .delete()
          .not('id', 'is', null);

        if (teachersError) {
          throw teachersError;
        }

        setMessage('✅ Full reset complete: all data and all teachers deleted. Logging out...');
        localStorage.removeItem('user');
        setTimeout(() => window.location.reload(), 1200);
      }

      setResetPassword('');
      setResetConfirmText('');
    } catch (error) {
      setMessage(`❌ Reset failed: ${error.message || 'Unknown error'}`);
    }

    setResetLoading(false);
  };

  const renderResetData = () => (
    <div className="card" style={{ border: '1px solid #fecaca', background: '#fff7ed' }}>
      <h2 style={{ marginTop: 0, marginBottom: '12px', fontSize: '20px', fontWeight: '700', color: '#991b1b' }}>Danger Zone: Reset Data</h2>
      <p style={{ marginTop: 0, marginBottom: '16px', color: '#7f1d1d', fontSize: '14px' }}>
        This action is irreversible. For security, you must enter your admin password and type RESET before deleting data.
      </p>

      <div style={{ display: 'grid', gap: '14px' }}>
        <div>
          <label className="form-label">Reset Mode</label>
          <select className="form-input" value={resetMode} onChange={(e) => setResetMode(e.target.value)}>
            <option value="teachers_except_me">Delete all data + all teachers except me</option>
            <option value="everything">Delete absolutely everything (including my account)</option>
          </select>
        </div>

        <div>
          <label className="form-label">Admin Password</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type={showResetPassword ? 'text' : 'password'}
              className="form-input"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Enter your password to authorize reset"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowResetPassword((prev) => !prev)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {showResetPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="form-label">Type RESET to confirm</label>
          <input
            type="text"
            className="form-input"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="RESET"
          />
        </div>

        <button
          onClick={handleResetData}
          disabled={resetLoading}
          className="btn-primary"
          style={{ background: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
        >
          <AlertTriangle size={18} />
          {resetLoading ? 'Resetting...' : 'Run Reset'}
        </button>
      </div>
    </div>
  );

  const visibleTabs = isAdmin ? tabs : teacherTabs;

  if (!isAdmin) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <SettingsIcon size={28} style={{ color: 'var(--primary)' }} />
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Settings</h1>
        </div>
        {message && (
          <div style={{ padding: '12px', background: '#d4edda', color: '#155724', borderRadius: '8px', marginBottom: '20px' }}>
            {message}
          </div>
        )}
        <div style={{ display: 'grid', gap: '16px' }}>
          {renderAdminProfile()}
          {renderTeacherAppearance()}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SettingsIcon size={28} style={{ color: 'var(--primary)' }} />
          <h1 style={{ margin: 0 }}>Settings</h1>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 20px', background: message.includes('✅') ? '#10b981' : '#ef4444', color: 'white', borderRadius: '8px', marginBottom: '20px' }}>
          {message}
        </div>
      )}

      {isCompactSettingsNav && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <label className="form-label">Settings Section</label>
          <select
            className="form-input"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            {visibleTabs.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: isCompactSettingsNav ? 'block' : 'flex', gap: '20px' }}>
        {/* Vertical Sidebar */}
        {!isCompactSettingsNav && (
          <div style={{ width: '250px', flexShrink: 0 }}>
            <div className="card" style={{ padding: '8px' }}>
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                      color: activeTab === tab.id ? 'white' : 'var(--text-dark)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: activeTab === tab.id ? '600' : '400',
                      textAlign: 'left',
                      marginBottom: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div style={{ flex: 1 }}>
          {activeTab === 'admin-profile' && renderAdminProfile()}
          {activeTab === 'appearance' && renderTeacherAppearance()}
          {activeTab === 'school' && renderSchoolProfile()}
          {activeTab === 'attendance' && renderAttendance()}
          {activeTab === 'sms' && renderSMS()}
          {activeTab === 'reporting' && renderReporting()}
          {activeTab === 'duty' && renderDuty()}
          {activeTab === 'reset-data' && renderResetData()}
        </div>
      </div>
    </div>
  );
}
