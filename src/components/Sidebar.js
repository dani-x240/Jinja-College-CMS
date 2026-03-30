import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  ClipboardList, 
  MessageSquare, 
  Calendar,
  FileText,
  Settings,
  Menu,
  LogOut
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { parseAssignedClasses } from '../utils/classAssignments';

export default function Sidebar({ collapsed, setCollapsed, activeTab, setActiveTab, user, onLogout }) {
  const [hasDuty, setHasDuty] = useState(false);
  const [isDutyHead, setIsDutyHead] = useState(false);
  const classTeacherAssignments = parseAssignedClasses(user.class_teacher_assigned);

  useEffect(() => {
    if (user.role !== 'admin') {
      checkDutyStatus();
    }
  }, [user]);

  const checkDutyStatus = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('duty_assignments')
      .select('is_duty_head')
      .eq('teacher_id', user.id)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .single();
    
    if (data) {
      setHasDuty(true);
      setIsDutyHead(data.is_duty_head);
    } else {
      setHasDuty(false);
      setIsDutyHead(false);
    }
  };

  const baseNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, featureType: 'base' }
  ];

  const teacherOnlyItems = user.role !== 'admin' ? [
    { id: 'students', label: 'View Students', icon: Users, featureType: 'teacher' },
    { id: 'reports', label: 'Reports', icon: FileText, featureType: 'teacher' },
    { id: 'settings', label: 'Settings', icon: Settings, featureType: 'teacher' }
  ] : [];

  const classTeacherItems = classTeacherAssignments.length > 0 ? [
    { id: 'my-class', label: 'My Class', icon: UserCheck, featureType: 'class-teacher' },
    { id: 'attendance', label: 'Attendance', icon: Calendar, featureType: 'class-teacher' },
    { id: 'sms', label: 'Send SMS', icon: MessageSquare, featureType: 'class-teacher' }
  ] : [];

  const dutyItems = hasDuty ? [
    { id: 'duty', label: isDutyHead ? 'Duty Dashboard (HEAD)' : 'Duty Dashboard', icon: ClipboardList, featureType: 'duty' }
  ] : [];

  const adminItems = user.role === 'admin' ? [
    { id: 'manage-students', label: 'Students', icon: Users, featureType: 'admin' },
    { id: 'teachers', label: 'Teachers', icon: Users, featureType: 'admin' },
    { id: 'classes', label: 'Classes', icon: Calendar, featureType: 'admin' },
    { id: 'duty-management', label: 'Duty Management', icon: Calendar, featureType: 'admin' },
    { id: 'reports', label: 'All Reports', icon: FileText, featureType: 'admin' },
    { id: 'settings', label: 'Settings', icon: Settings, featureType: 'admin' }
  ] : [];

  const navItems = user.role === 'admin' 
    ? [...baseNavItems, ...adminItems]
    : [...baseNavItems, ...teacherOnlyItems, ...classTeacherItems, ...dutyItems];

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">Jinja College cmc</div>
        <button className="hamburger-btn" onClick={() => setCollapsed(!collapsed)}>
          <Menu size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <div
            key={item.id}
            className={`nav-item ${item.featureType ? `feature-${item.featureType}` : ''} ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(item.id);
              if (window.innerWidth <= 768) setCollapsed(true);
            }}
          >
            <item.icon size={20} className="nav-icon" />
            <span className="nav-text">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="nav-item" onClick={onLogout} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <LogOut size={20} className="nav-icon" />
        <span className="nav-text">Logout</span>
      </div>
    </div>
  );
}
