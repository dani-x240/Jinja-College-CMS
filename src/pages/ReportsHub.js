import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase';
import { parseAssignedClasses } from '../utils/classAssignments';
import SubmitReport from './SubmitReport';
import MyReports from './MyReports';
import ClassReports from './ClassReports';

export default function ReportsHub({ user }) {
  const classTeacherClasses = parseAssignedClasses(user.class_teacher_assigned);
  const [tableStatus, setTableStatus] = useState({
    loading: true,
    lessonReports: true,
    streamReports: true
  });

  useEffect(() => {
    const checkTable = async (tableName) => {
      const primary = await supabase.schema('public').from(tableName).select('id').limit(1);
      if (!primary.error) return true;

      const fallback = await supabase.from(tableName).select('id').limit(1);
      if (!fallback.error) return true;

      const message = `${primary.error?.message || ''} ${fallback.error?.message || ''}`.toLowerCase();
      return !message.includes('relation') || !message.includes(tableName);
    };

    const loadStatus = async () => {
      const [lessonReports, streamReports] = await Promise.all([
        checkTable('lesson_reports'),
        checkTable('stream_reports')
      ]);

      setTableStatus({
        loading: false,
        lessonReports,
        streamReports
      });
    };

    loadStatus();
  }, []);

  const tabs = useMemo(() => {
    const baseTabs = [];

    if (tableStatus.lessonReports) {
      baseTabs.push({ id: 'submit', label: 'Lesson Report' });
      baseTabs.push({ id: 'recent', label: 'Recent Reports' });
    }

    if (classTeacherClasses.length > 0 && tableStatus.lessonReports && tableStatus.streamReports) {
      baseTabs.push({ id: 'class', label: 'Class Reports' });
    }

    return baseTabs;
  }, [user.class_teacher_assigned, tableStatus.lessonReports, tableStatus.streamReports]);

  const [activeTab, setActiveTab] = useState('submit');

  useEffect(() => {
    if (!tabs.find((tab) => tab.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  if (tableStatus.loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading reports...</div>;
  }

  if (!tableStatus.lessonReports) {
    return (
      <div className="card" style={{ padding: '20px', background: '#fff7ed', border: '1px solid #fdba74' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: '#9a3412' }}>
          Reports database is not ready
        </div>
        <div style={{ color: '#7c2d12', fontSize: '14px' }}>
          Ask the administrator to run add_full_reports_system_fresh.sql in Supabase SQL Editor.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '8px 14px' }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'submit' && <SubmitReport user={user} />}
      {activeTab === 'recent' && <MyReports user={user} />}
      {activeTab === 'class' && <ClassReports user={user} />}
    </div>
  );
}
