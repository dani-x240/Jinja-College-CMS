import React, { useState, useEffect } from 'react';
import { Calendar, Save, Check } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { parseAssignedClasses } from '../utils/classAssignments';

export default function Attendance({ user, selectedClassFilter }) {
  const assignedClasses = parseAssignedClasses(user.class_assigned);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [activeClassFilter, setActiveClassFilter] = useState(user.class_assigned || selectedClassFilter || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState({});
  const [saving, setSaving] = useState(false);

  const canMarkAttendance = (user?.role === 'admin') || (user?.role === 'teacher' && !(user?.class_teacher_assigned));

  useEffect(() => {
    loadClassOptions();
  }, []);

  useEffect(() => {
    if (assignedClasses.length === 1) {
      setActiveClassFilter(assignedClasses[0]);
      return;
    }

    if (assignedClasses.length > 1 && (!activeClassFilter || !assignedClasses.includes(activeClassFilter))) {
      setActiveClassFilter(assignedClasses[0]);
      return;
    }

    if (selectedClassFilter) {
      setActiveClassFilter(selectedClassFilter);
    }
  }, [user.class_assigned, selectedClassFilter]);

  useEffect(() => {
    if (activeClassFilter) {
      loadStudentsAndAttendance();
    } else {
      setStudents([]);
      setAttendance({});
    }
  }, [date, activeClassFilter]);

  const loadClassOptions = async () => {
    const [classesResponse, streamsResponse] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('streams').select('*')
    ]);

    setClasses(classesResponse.data || []);
    setStreams(streamsResponse.data || []);
  };

  const classOptions = classes.flatMap((classItem) => {
    if (classItem.has_streams) {
      return streams
        .filter((stream) => stream.class_id === classItem.id)
        .map((stream) => `${classItem.name} ${stream.name}`.trim());
    }

    return [classItem.name];
  });

  const visibleClassOptions = user.role === 'admin'
    ? classOptions
    : classOptions.filter((className) => assignedClasses.includes(className));

  const matchesClassFilter = (className = '') => {
    const normalizedClassName = className.trim().toLowerCase();
    const normalizedFilter = (activeClassFilter || '').trim().toLowerCase();

    if (!normalizedClassName || !normalizedFilter) {
      return false;
    }

    return normalizedClassName === normalizedFilter || normalizedClassName.startsWith(`${normalizedFilter} `);
  };

  const loadStudentsAndAttendance = async () => {
    const { data } = await supabase
      .from('students')
      .select('*');

    const normalizedStudents = (data || [])
      .map((student) => ({
        ...student,
        displayName: student.full_name || student.name || '',
        displayClass: student.class_name || student.class || ''
      }))
      .filter((student) => matchesClassFilter(student.displayClass))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    setStudents(normalizedStudents);

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('attendance_date', date);

    const filteredData = (attendanceData || []).filter((record) => matchesClassFilter(record.class_name || ''));

    // Always default every student to present unless there is an existing saved record.
    const attendanceMap = Object.fromEntries(normalizedStudents.map((student) => [student.id, 'present']));
    filteredData.forEach(record => {
      attendanceMap[record.student_id] = record.status;
    });
    setAttendance(attendanceMap);
  };

  const handleStatusChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = () => {
    const allPresent = {};
    students.forEach(s => allPresent[s.id] = 'present');
    setAttendance(allPresent);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const studentIds = students.map((student) => student.id);
      const { data: existingRecords = [] } = await supabase
        .from('attendance')
        .select('id, student_id')
        .in('student_id', studentIds)
        .eq('attendance_date', date);

      const existingByStudentId = new Map(existingRecords.map((record) => [String(record.student_id), record]));
      const updates = [];
      const inserts = [];

      students.forEach((student) => {
        const status = attendance[student.id] || 'present';
        const existing = existingByStudentId.get(String(student.id));

        if (existing) {
          updates.push(
            supabase
              .from('attendance')
              .update({
                status,
                marked_by: user.id,
                marked_by_name: user.name
              })
              .eq('id', existing.id)
          );
        } else {
          inserts.push({
            student_id: student.id,
            student_name: student.displayName,
            class_name: student.displayClass,
            attendance_date: date,
            status,
            marked_by: user.id,
            marked_by_name: user.name
          });
        }
      });

      const updateResults = await Promise.all(updates);
      const updateError = updateResults.find((result) => result.error)?.error;
      if (updateError) {
        throw updateError;
      }

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from('attendance').insert(inserts);
        if (insertError) {
          throw insertError;
        }
      }

      alert('Attendance saved successfully.');
      loadStudentsAndAttendance();
    } catch (error) {
      alert('We could not save attendance right now. Please try again.');
    }
    setSaving(false);
  };

  if (!canMarkAttendance) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-gray)' }}>
        Only teachers (not class teachers) or admins can mark attendance.
      </div>
    );
  }

  if (!activeClassFilter) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-gray)' }}>
        Select a class to mark attendance.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Mark Attendance - {activeClassFilter}</h2>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label className="form-label">Class/Stream</label>
        <select
          className="form-input"
          value={activeClassFilter}
          onChange={(e) => setActiveClassFilter(e.target.value)}
          disabled={Boolean(user.class_assigned)}
          style={{ maxWidth: '280px' }}
        >
          <option value="">Select Class/Stream</option>
          {visibleClassOptions.map((className) => (
            <option key={className} value={className}>{className}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'end' }}>
        <div>
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: '180px' }}
          />
        </div>
        <button className="btn-secondary" onClick={markAllPresent} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Check size={16} /> Mark All Present
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th style={{ textAlign: 'center' }}>Present</th>
              <th style={{ textAlign: 'center' }}>Absent</th>
              <th style={{ textAlign: 'center' }}>Late</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)' }}>
                  No students found in {activeClassFilter}
                </td>
              </tr>
            ) : (
              students.map(student => (
                <tr key={student.id}>
                  <td style={{ fontWeight: '600' }}>{student.displayName}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="radio"
                      name={`attendance-${student.id}`}
                      checked={attendance[student.id] === 'present'}
                      onChange={() => handleStatusChange(student.id, 'present')}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="radio"
                      name={`attendance-${student.id}`}
                      checked={attendance[student.id] === 'absent'}
                      onChange={() => handleStatusChange(student.id, 'absent')}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="radio"
                      name={`attendance-${student.id}`}
                      checked={attendance[student.id] === 'late'}
                      onChange={() => handleStatusChange(student.id, 'late')}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
