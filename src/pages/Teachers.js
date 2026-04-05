import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Search, Download, User, Key, XCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { validateClassAssignment } from '../utils/teacherUtils';
import { classMatches, matchesAnyAssignedClass, parseAssignedClasses, stringifyAssignedClasses } from '../utils/classAssignments';

export default function Teachers({ user }) {
  const isAdmin = user?.role === 'admin';
  const manageableClasses = isAdmin ? [] : parseAssignedClasses(user?.class_teacher_assigned);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileData, setProfileData] = useState({ reports: 0, duty: [], sms: 0, attendanceMarked: 0, absentOrLate: 0 });
  const [showReject, setShowReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedAssignments, setSelectedAssignments] = useState([]);
  const [managedClass, setManagedClass] = useState(manageableClasses[0] || '');
  const [formData, setFormData] = useState({
    staff_id: '',
    name: '',
    phone: '',
    subjects: '',
    password: '',
    role: 'teacher',
    class_assigned: '',
    class_teacher_assigned: ''
  });

  const isMissingClassTeacherColumnError = (error) => {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes('class_teacher_assigned') && (text.includes('schema cache') || text.includes('column'));
  };

  useEffect(() => {
    loadTeachers();
    loadClasses();
    loadStreams();
  }, []);

  useEffect(() => {
    if (isAdmin) return;

    if (manageableClasses.length > 0) {
      if (!managedClass || !manageableClasses.includes(managedClass)) {
        setManagedClass(manageableClasses[0]);
      }
      return;
    }

    if (managedClass) {
      setManagedClass('');
    }
  }, [isAdmin, user?.id, user?.class_teacher_assigned]);

  const canManageSelectedClass = isAdmin || (Boolean(managedClass) && manageableClasses.some((item) => classMatches(item, managedClass)));

  const syncMissingClassTeacherAssignments = async (teacherRows = []) => {
    const candidates = teacherRows
      .map((teacher) => {
        const assignments = parseAssignedClasses(teacher.class_assigned);
        return {
          id: teacher.id,
          classTeacherAssigned: teacher.class_teacher_assigned,
          assignments
        };
      })
      .filter((teacher) => !teacher.classTeacherAssigned && teacher.assignments.length === 1);

    if (candidates.length === 0) {
      return 0;
    }

    let updatedCount = 0;
    for (const candidate of candidates) {
      const classTeacherStream = candidate.assignments[0];
      const { error } = await supabase
        .from('teachers')
        .update({ class_teacher_assigned: classTeacherStream })
        .eq('id', candidate.id);

      if (!error) {
        updatedCount += 1;
      }
    }

    return updatedCount;
  };

  const loadTeachers = async () => {
    const { data } = await supabase.from('teachers').select('*').order('name');
    let finalData = data || [];

    if (isAdmin && finalData.length > 0) {
      const syncedCount = await syncMissingClassTeacherAssignments(finalData);
      if (syncedCount > 0) {
        const { data: refreshedData } = await supabase.from('teachers').select('*').order('name');
        finalData = refreshedData || finalData;
      }
    }

    setTeachers(finalData);
    setLoading(false);
  };

  const loadClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('name');
    setClasses(data || []);
  };

  const loadStreams = async () => {
    const { data } = await supabase.from('streams').select('*');
    setStreams(data || []);
  };

  const classAssignmentOptions = classes.flatMap((classItem) => {
    if (classItem.has_streams) {
      return streams
        .filter((stream) => stream.class_id === classItem.id)
        .map((stream) => `${classItem.name} ${stream.name}`.trim());
    }

    return [classItem.name];
  });

  // Keep assignment options visible even if classes/streams tables are temporarily empty.
  const mergedAssignmentOptions = [...new Set([
    ...classAssignmentOptions,
    ...teachers.flatMap((teacher) => parseAssignedClasses(teacher.class_assigned)),
    ...parseAssignedClasses(editingTeacher?.class_assigned || ''),
    `${editingTeacher?.class_teacher_assigned || ''}`.trim()
  ].map((item) => `${item || ''}`.trim()).filter(Boolean))];

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setSelectedAssignments(parseAssignedClasses(teacher.class_assigned));
    setFormData({
      staff_id: teacher.staff_id,
      name: teacher.name,
      phone: teacher.phone,
      subjects: teacher.subjects,
      password: '',
      role: teacher.role || 'teacher',
      class_assigned: teacher.class_assigned || '',
      class_teacher_assigned: teacher.class_teacher_assigned || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const normalizedStaffId = `${formData.staff_id || ''}`.trim();
      if (!normalizedStaffId) {
        alert('❌ Staff ID is required.');
        return;
      }

      const { data: existingStaffRecord, error: existingStaffLookupError } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('staff_id', normalizedStaffId)
        .maybeSingle();

      if (existingStaffLookupError) {
        throw new Error(existingStaffLookupError.message || 'Failed to validate staff ID');
      }

      if (existingStaffRecord && (!editingTeacher || String(existingStaffRecord.id) !== String(editingTeacher.id))) {
        alert(`❌ Staff ID ${normalizedStaffId} already belongs to ${existingStaffRecord.name}. Use a different Staff ID.`);
        return;
      }

      let classTeacherColumnMissing = false;
      let normalizedAssignments = [...new Set(selectedAssignments.map((item) => `${item || ''}`.trim()).filter(Boolean))];
      // If exactly one stream is assigned and class teacher stream is empty,
      // auto-place that teacher as class teacher for consistency.
      const autoClassTeacher = normalizedAssignments.length === 1 ? normalizedAssignments[0] : null;
      const classTeacherValue = `${formData.class_teacher_assigned || ''}`.trim() || autoClassTeacher || null;

      // Class-teacher stream should always appear in the teacher's teaching assignments.
      if (classTeacherValue && !normalizedAssignments.some((item) => classMatches(item, classTeacherValue))) {
        normalizedAssignments = [...normalizedAssignments, classTeacherValue];
      }

      for (const assignment of normalizedAssignments) {
        const isValid = await validateClassAssignment(assignment);
        if (!isValid) {
          alert(`❌ Invalid class/stream: ${assignment}. Please select a valid class/stream.`);
          return;
        }
      }

      const assignmentValue = stringifyAssignedClasses(normalizedAssignments) || null;

      if (classTeacherValue) {
        const isValidClassTeacherAssignment = await validateClassAssignment(classTeacherValue);
        if (!isValidClassTeacherAssignment) {
          alert(`❌ Invalid class teacher stream: ${classTeacherValue}. Please select a valid class/stream.`);
          return;
        }

        const { data: existingClassTeacher, error: classTeacherLookupError } = await supabase
          .from('teachers')
          .select('id, name')
          .eq('class_teacher_assigned', classTeacherValue)
          .neq('id', editingTeacher?.id || 0)
          .maybeSingle();

        if (classTeacherLookupError && isMissingClassTeacherColumnError(classTeacherLookupError)) {
          classTeacherColumnMissing = true;
        }

        if (existingClassTeacher) {
          alert(`❌ ${classTeacherValue} already has class teacher ${existingClassTeacher.name}.`);
          return;
        }
      }
      
      if (editingTeacher) {
        const updateData = {
          staff_id: normalizedStaffId,
          name: formData.name,
          phone: formData.phone,
          subjects: formData.subjects,
          role: formData.role,
          class_assigned: assignmentValue,
          class_teacher_assigned: classTeacherValue
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        let { error: updateError } = await supabase
          .from('teachers')
          .update(updateData)
          .eq('id', editingTeacher.id);

        if (updateError && isMissingClassTeacherColumnError(updateError)) {
          classTeacherColumnMissing = true;
          const fallbackUpdateData = {
            staff_id: normalizedStaffId,
            name: formData.name,
            phone: formData.phone,
            subjects: formData.subjects,
            role: formData.role,
            class_assigned: assignmentValue
          };
          if (formData.password) {
            fallbackUpdateData.password = formData.password;
          }

          const fallback = await supabase
            .from('teachers')
            .update(fallbackUpdateData)
            .eq('id', editingTeacher.id);
          updateError = fallback.error;
        }

        if (updateError) {
          throw new Error(updateError.message || 'Failed to update teacher');
        }

        alert(
          classTeacherColumnMissing
            ? '✅ Teacher updated. Note: Class Teacher stream is not saved yet because database column class_teacher_assigned is missing. Run add_class_teacher_assigned.sql.'
            : '✅ Teacher updated successfully!'
        );
      } else {
        let insertPayload = {
          ...formData,
          staff_id: normalizedStaffId,
          class_assigned: assignmentValue,
          class_teacher_assigned: classTeacherValue,
          approved: true
        };

        let { error: insertError } = await supabase.from('teachers').insert(insertPayload);

        if (insertError && isMissingClassTeacherColumnError(insertError)) {
          classTeacherColumnMissing = true;
          insertPayload = {
            staff_id: normalizedStaffId,
            name: formData.name,
            phone: formData.phone,
            subjects: formData.subjects,
            password: formData.password,
            role: formData.role,
            class_assigned: assignmentValue,
            approved: true
          };
          const fallback = await supabase.from('teachers').insert(insertPayload);
          insertError = fallback.error;
        }

        if (insertError) {
          throw new Error(insertError.message || 'Failed to add teacher');
        }

        alert(
          classTeacherColumnMissing
            ? '✅ Teacher added. Note: Class Teacher stream is not saved yet because database column class_teacher_assigned is missing. Run add_class_teacher_assigned.sql.'
            : '✅ Teacher added successfully!'
        );
      }
      setShowModal(false);
      setEditingTeacher(null);
      setSelectedAssignments([]);
      loadTeachers();
      setFormData({ staff_id: '', name: '', phone: '', subjects: '', password: '', role: 'teacher', class_assigned: '', class_teacher_assigned: '' });
    } catch (error) {
      const rawText = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
      if (rawText.includes('teachers_staff_id_key') || rawText.includes('duplicate key value')) {
        alert(`❌ Staff ID ${`${formData.staff_id || ''}`.trim()} already exists. Use a different Staff ID.`);
      } else {
        alert(`❌ Error saving teacher: ${error.message || 'unknown error'}`);
      }
    }
  };

  const toggleAssignment = (assignmentName) => {
    setSelectedAssignments((previous) =>
      previous.includes(assignmentName)
        ? previous.filter((item) => item !== assignmentName)
        : [...previous, assignmentName]
    );
  };

  const handleClassTeacherAssign = async (teacher) => {
    if (!managedClass) {
      alert('Select class/stream first.');
      return;
    }

    if (!canManageSelectedClass) {
      alert(`You can only assign teachers for your managed class/stream: ${manageableClasses.join(', ') || 'none'}.`);
      return;
    }

    if (String(teacher.id) === String(user?.id)) {
      alert('You are already the class teacher for this class/stream.');
      return;
    }

    const currentAssignments = parseAssignedClasses(teacher.class_assigned);
    if (currentAssignments.some((item) => classMatches(item, managedClass))) {
      alert(`${teacher.name} is already assigned to ${managedClass}.`);
      return;
    }

    const updatedAssignments = [...currentAssignments, managedClass];
    const { error } = await supabase
      .from('teachers')
      .update({
        class_assigned: stringifyAssignedClasses(updatedAssignments),
        class_teacher_assigned: teacher.class_teacher_assigned || managedClass
      })
      .eq('id', teacher.id);

    if (error) {
      alert('❌ Failed to assign teacher: ' + error.message);
      return;
    }

    alert(`✅ ${teacher.name} assigned to ${managedClass}`);
    loadTeachers();
  };

  const handleClassTeacherUnassign = async (teacher) => {
    if (!managedClass) return;

    if (!canManageSelectedClass) {
      alert(`You can only remove teachers for your managed class/stream: ${manageableClasses.join(', ') || 'none'}.`);
      return;
    }

    const currentAssignments = parseAssignedClasses(teacher.class_assigned);
    const updatedAssignments = currentAssignments.filter((item) => !classMatches(item, managedClass));

    if (updatedAssignments.length === currentAssignments.length) {
      return;
    }

    const { error } = await supabase
      .from('teachers')
      .update({ class_assigned: stringifyAssignedClasses(updatedAssignments) || null })
      .eq('id', teacher.id);

    if (error) {
      alert('❌ Failed to remove teacher: ' + error.message);
      return;
    }

    alert(`✅ ${teacher.name} removed from ${managedClass}`);
    loadTeachers();
  };

  const handleApprove = async (id) => {
    await supabase.from('teachers').update({ approved: true }).eq('id', id);
    loadTeachers();
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    await supabase.from('teachers').update({ approved: false, rejection_reason: rejectReason }).eq('id', id);
    setShowReject(null);
    setRejectReason('');
    loadTeachers();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this teacher?')) {
      await supabase.from('teachers').delete().eq('id', id);
      loadTeachers();
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData({...formData, password: pwd});
  };

  const viewProfile = async (teacher) => {
    setSelectedProfile(teacher);
    const [repCount, smsCount, attendanceResponse] = await Promise.all([
      supabase.from('lesson_reports').select('id', { count: 'exact' }).eq('teacher_id', teacher.id),
      supabase.from('sms_logs').select('id', { count: 'exact' }).eq('teacher_id', teacher.id),
      supabase.from('attendance').select('status').eq('marked_by', teacher.id)
    ]);

    const attendanceRows = attendanceResponse?.data || [];
    const absentOrLateCount = attendanceRows.filter((row) => {
      const status = `${row?.status || ''}`.toLowerCase();
      return status === 'absent' || status === 'late';
    }).length;

    setProfileData({
      reports: repCount.count || 0,
      duty: [],
      sms: smsCount.count || 0,
      attendanceMarked: attendanceRows.length,
      absentOrLate: absentOrLateCount
    });
    setShowProfile(true);
  };

  const exportToExcel = () => {
    const csv = [
      ['Staff ID', 'Name', 'Phone', 'Subjects', 'Role', 'Class', 'Class Teacher Stream', 'Status'].join(','),
      ...filteredTeachers.map(t => [
        t.staff_id, t.name, t.phone, t.subjects, t.role, t.class_assigned || '-', t.class_teacher_assigned || '-', t.approved ? 'Approved' : 'Pending'
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teachers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredTeachers = teachers.filter(t => {
    if (!isAdmin) {
      if (t.role === 'admin' || !t.approved) return false;
      if (String(t.id) === String(user?.id)) return false;

      // Clean the non-admin assignment list: if teacher is already class teacher
      // for the currently managed stream, remove them from this list.
      if (managedClass && classMatches(t.class_teacher_assigned || '', managedClass)) {
        return false;
      }
    }

    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.staff_id.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || t.role === filterRole;
    const matchesStatus = !filterStatus || (filterStatus === 'approved' ? t.approved : !t.approved);
    const matchesClass = !filterClass || matchesAnyAssignedClass(t.class_assigned || '', [filterClass]);
    return matchesSearch && matchesRole && matchesStatus && matchesClass;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>{isAdmin ? 'Teacher Management' : 'Assign Teachers For Your Class'}</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => { setEditingTeacher(null); setSelectedAssignments([]); setShowModal(true); }}>
            <Plus size={18} />
            Add Teacher
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <label className="form-label">Managed Class/Stream</label>
          {manageableClasses.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#9a3412' }}>
              You do not have any class teacher stream assigned. You cannot assign/remove teachers.
            </div>
          ) : (
            <select className="form-input" value={managedClass} onChange={(e) => setManagedClass(e.target.value)} style={{ maxWidth: '260px' }}>
              {manageableClasses.map((className) => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          )}
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-gray)' }}>
            {canManageSelectedClass
              ? `You can assign subject teachers for ${managedClass}.`
              : `You cannot assign teachers for ${managedClass}. Allowed managed class/stream(s): ${manageableClasses.join(', ') || 'none'}.`}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
          <input type="text" className="form-input" placeholder="Search by name or staff ID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '40px' }} />
        </div>
        {isAdmin && (
          <select className="form-input" value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={{ width: '130px' }}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
          </select>
        )}
        {isAdmin && (
          <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '130px' }}>
            <option value="">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </select>
        )}
        {isAdmin && (
          <select className="form-input" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: '180px' }}>
            <option value="">All Classes</option>
            {[...new Set(teachers.flatMap((teacher) => parseAssignedClasses(teacher.class_assigned)))].map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        )}
        {isAdmin && (
          <button className="btn-secondary" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
            <Download size={18} /> Export Excel
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Subjects</th>
              <th>Role</th>
              <th>Classes Taught</th>
              <th>Class Teacher Stream</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>Loading...</td>
              </tr>
            ) : filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)' }}>
                  No teachers found
                </td>
              </tr>
            ) : (
              filteredTeachers.map(teacher => (
                <tr key={teacher.id}>
                  <td>{teacher.staff_id}</td>
                  <td style={{ fontWeight: '600' }}>{teacher.name}</td>
                  <td>{teacher.phone}</td>
                  <td>{teacher.subjects}</td>
                  <td>{teacher.role === 'admin' ? 'Administrator' : 'Teacher'}</td>
                  <td>{teacher.class_assigned || '-'}</td>
                  <td>{teacher.class_teacher_assigned || '-'}</td>
                  <td>
                    {teacher.approved ? (
                      <span className="badge green">Approved</span>
                    ) : (
                      <span className="badge orange">Pending</span>
                    )}
                  </td>
                  <td>
                    {isAdmin && !teacher.approved && (
                      <>
                        <button className="btn-primary" style={{ marginRight: '8px', padding: '6px 12px', fontSize: '13px' }} onClick={() => handleApprove(teacher.id)}>
                          Approve
                        </button>
                        <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px', fontSize: '13px', background: '#fee2e2', color: '#dc2626' }} onClick={() => setShowReject(teacher.id)}>
                          Reject
                        </button>
                      </>
                    )}
                    {isAdmin ? (
                      <>
                        <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px' }} onClick={() => viewProfile(teacher)}>
                          <User size={16} />
                        </button>
                        <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px' }} onClick={() => handleEdit(teacher)}>
                          <Edit size={16} />
                        </button>
                        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => handleDelete(teacher.id)}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-secondary"
                          style={{ marginRight: '8px', padding: '6px 12px' }}
                          onClick={() => handleClassTeacherAssign(teacher)}
                          disabled={!canManageSelectedClass}
                        >
                          <Check size={16} /> Assign
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', background: '#fff1f2', color: '#be123c' }}
                          onClick={() => handleClassTeacherUnassign(teacher)}
                          disabled={!canManageSelectedClass}
                        >
                          <X size={16} /> Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && isAdmin && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingTeacher(null); setSelectedAssignments([]); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</h3>
              <button onClick={() => { setShowModal(false); setEditingTeacher(null); setSelectedAssignments([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Staff ID</label>
                <input type="text" className="form-input" value={formData.staff_id} onChange={(e) => setFormData({...formData, staff_id: e.target.value})} required disabled={editingTeacher} />
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Subjects</label>
                <input type="text" className="form-input" value={formData.subjects} onChange={(e) => setFormData({...formData, subjects: e.target.value})} placeholder="e.g., Math, Physics" required />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} required>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Password {editingTeacher && '(leave blank to keep current)'}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" className="form-input" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required={!editingTeacher} />
                  <button type="button" className="btn-secondary" onClick={generatePassword} style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <Key size={16} /> Generate
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Class Assignment (Optional)</label>
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', padding: '8px' }}>
                  {mergedAssignmentOptions.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-gray)' }}>No class/stream options found.</div>
                  ) : (
                    mergedAssignmentOptions.map((classOption) => (
                      <label key={classOption} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedAssignments.includes(classOption)}
                          onChange={() => toggleAssignment(classOption)}
                        />
                        <span>{classOption}</span>
                      </label>
                    ))
                  )}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setSelectedAssignments([])}>
                    Clear Assignments
                  </button>
                </div>
                {selectedAssignments.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-gray)' }}>
                    Assigned: {selectedAssignments.join(', ')}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--text-gray)', marginTop: '4px' }}>
                  Assigned teachers will see these classes/streams in My Class, Attendance, SMS, Lesson Reports, and Class Reports.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Class Teacher Stream (Single)</label>
                <select
                  className="form-input"
                  value={formData.class_teacher_assigned}
                  onChange={(e) => setFormData({ ...formData, class_teacher_assigned: e.target.value })}
                >
                  <option value="">None</option>
                  {mergedAssignmentOptions.map((classOption) => (
                    <option key={`class-teacher-${classOption}`} value={classOption}>{classOption}</option>
                  ))}
                </select>
                <div style={{ fontSize: '12px', color: 'var(--text-gray)', marginTop: '4px' }}>
                  This controls who can assign/remove teachers for a stream.
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                <Check size={18} />
                {editingTeacher ? 'Update Teacher' : 'Add Teacher'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showReject && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowReject(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Reject Teacher</h3>
              <button onClick={() => setShowReject(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Rejection Reason</label>
              <textarea className="form-input" rows="4" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this teacher is being rejected..." />
            </div>
            <button className="btn-primary" onClick={() => handleReject(showReject)} style={{ width: '100%', background: '#dc2626' }}>
              <XCircle size={18} /> Reject Teacher
            </button>
          </div>
        </div>
      )}

      {showProfile && selectedProfile && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal-content" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700' }}>{selectedProfile.name}</h2>
                <div style={{ color: 'var(--text-gray)' }}>{selectedProfile.staff_id} • {selectedProfile.role === 'admin' ? 'Administrator' : 'Teacher'}</div>
              </div>
              <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginBottom: '4px' }}>Reports Submitted</div>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--primary)' }}>{profileData.reports}</div>
              </div>
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginBottom: '4px' }}>SMS Sent</div>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--green)' }}>{profileData.sms}</div>
              </div>
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginBottom: '4px' }}>Attendance Marked</div>
                <div style={{ fontSize: '24px', fontWeight: '600', color: '#0f766e' }}>{profileData.attendanceMarked}</div>
              </div>
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-gray)', marginBottom: '4px' }}>Absent/Late Entries</div>
                <div style={{ fontSize: '24px', fontWeight: '600', color: '#b45309' }}>{profileData.absentOrLate}</div>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Contact Information</h3>
              <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ marginBottom: '8px' }}><strong>Phone:</strong> {selectedProfile.phone}</div>
                <div style={{ marginBottom: '8px' }}><strong>Subjects:</strong> {selectedProfile.subjects}</div>
                <div><strong>Classes Assigned:</strong> {selectedProfile.class_assigned || 'None'}</div>
                <div><strong>Class Teacher Stream:</strong> {selectedProfile.class_teacher_assigned || 'None'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
