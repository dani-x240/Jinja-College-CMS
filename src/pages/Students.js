import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, X, Check, Download, Filter, CheckSquare, Square, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';

export default function Students({ user }) {
  const defaultStudentSchema = {
    admission_no: true,
    full_name: true,
    name: false,
    gender: true,
    class_name: true,
    class: false,
    parent_name: true,
    parent_phone: true,
    date_of_birth: true,
    notes: true,
    attendance_percentage: true,
    category: true
  };

  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [studentSchema, setStudentSchema] = useState(defaultStudentSchema);
  const [formData, setFormData] = useState({
    admission_no: '',
    full_name: '',
    gender: '',
    class_name: '',
    parent_name: '',
    parent_phone: '',
    date_of_birth: '',
    notes: ''
  });

  useEffect(() => {
    initializeStudentsPage();
  }, []);

  const isMissingStudentColumnError = (error) => {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();

    return message.includes('students') && (
      message.includes('schema cache') ||
      message.includes('could not find the') ||
      message.includes('column')
    );
  };

  const detectStudentSchema = async () => {
    const checks = [
      ['admission_no', true],
      ['full_name', true],
      ['name', false],
      ['gender', true],
      ['class_name', true],
      ['class', false],
      ['parent_name', true],
      ['parent_phone', true],
      ['date_of_birth', true],
      ['notes', true],
      ['attendance_percentage', true],
      ['category', true]
    ];

    const results = {};

    for (const [column, defaultValue] of checks) {
      const { error } = await supabase.from('students').select(column).limit(1);
      results[column] = error ? false : true;

      if (error && !isMissingStudentColumnError(error)) {
        results[column] = defaultValue;
      }
    }

    setStudentSchema(results);
    return results;
  };

  const initializeStudentsPage = async () => {
    const schema = await detectStudentSchema();
    await Promise.all([loadStudents(schema), loadClasses()]);
  };

  const normalizeGenderForDisplay = (value = '') => {
    const normalized = value.trim().toLowerCase();

    if (['m', 'male', 'boy'].includes(normalized)) return 'M';
    if (['f', 'female', 'girl'].includes(normalized)) return 'F';

    return value || 'Not specified';
  };

  const getSchoolId = (student, index) => {
    if (student.admission_no) return student.admission_no;
    return `JICO/${String(index + 1).padStart(4, '0')}`;
  };

  const normalizeStudentRecord = (student) => ({
    ...student,
    admission_no: student.admission_no || `STU-${student.id}`,
    full_name: student.full_name || student.name || '',
    class_name: student.class_name || student.class || '',
    parent_name: student.parent_name || '',
    parent_phone: student.parent_phone || '',
    gender: normalizeGenderForDisplay(student.gender || ''),
    date_of_birth: student.date_of_birth || '',
    notes: student.notes || '',
    attendance_percentage: typeof student.attendance_percentage === 'number'
      ? student.attendance_percentage
      : student.category === 'green'
        ? 95
        : student.category === 'orange'
          ? 75
          : student.category === 'red'
            ? 50
            : 0
  });

  const normalizeGenderForDatabase = (value = '') => {
    const normalized = normalizeGenderForDisplay(value);
    if (normalized === 'M') return studentSchema.name ? 'Male' : 'M';
    if (normalized === 'F') return studentSchema.name ? 'Female' : 'F';
    return studentSchema.name ? 'Male' : 'M';
  };

  const buildStudentPayload = (data) => {
    const payload = {};

    if (studentSchema.admission_no && data.admission_no) payload.admission_no = data.admission_no;
    if (studentSchema.full_name) payload.full_name = data.full_name;
    if (studentSchema.name) payload.name = data.full_name;
    if (studentSchema.gender) payload.gender = normalizeGenderForDatabase(data.gender);
    if (studentSchema.class_name) payload.class_name = data.class_name;
    if (studentSchema.class) payload.class = data.class_name;
    if (studentSchema.parent_name) payload.parent_name = data.parent_name;
    if (studentSchema.parent_phone) payload.parent_phone = data.parent_phone;
    if (studentSchema.date_of_birth) payload.date_of_birth = data.date_of_birth || null;
    if (studentSchema.notes) payload.notes = data.notes || '';
    if (studentSchema.category) payload.category = getCategory(data.attendance_percentage || 95).toLowerCase();

    return payload;
  };

  const loadClasses = async () => {
    try {
      const { data: classesData } = await supabase.from('classes').select('*').order('name');
      const { data: streamsData } = await supabase.from('streams').select('*');
      setClasses(classesData || []);
      setStreams(streamsData || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadStudents = async (schema = studentSchema) => {
    try {
      let query = supabase.from('students').select('*');
      
      if (user.class_assigned && user.role !== 'admin') {
        query = schema.class_name
          ? query.eq('class_name', user.class_assigned)
          : query.eq('class', user.class_assigned);
      }

      const { data, error } = await query.order(schema.full_name ? 'full_name' : 'name');
      
      if (error) throw error;
      setStudents((data || []).map(normalizeStudentRecord));
    } catch (error) {
      console.error('Error loading students:', error);
    }
    setLoading(false);
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      admission_no: student.admission_no,
      full_name: student.full_name,
      gender: student.gender,
      class_name: student.class_name,
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      date_of_birth: student.date_of_birth || '',
      notes: student.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update(buildStudentPayload(formData))
          .eq('id', editingStudent.id);

        if (error) throw error;
        alert('✅ Student updated successfully!');
      } else {
        if (studentSchema.admission_no) {
          const { data: existing } = await supabase
            .from('students')
            .select('admission_no')
            .eq('admission_no', formData.admission_no)
            .maybeSingle();

          if (existing) {
            alert('⚠️ School ID already exists. Please use a different ID.');
            setLoading(false);
            return;
          }
        }

        const { error } = await supabase.from('students').insert(buildStudentPayload(formData));
        if (error) throw error;
        alert('✅ Student added successfully!');
      }
      
      setShowModal(false);
      setEditingStudent(null);
      loadStudents();
      setFormData({ admission_no: '', full_name: '', gender: '', class_name: '', parent_name: '', parent_phone: '', date_of_birth: '', notes: '' });
    } catch (error) {
      alert('Error saving student: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      await supabase.from('students').delete().eq('id', id);
      loadStudents();
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = (s.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.admission_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.class_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesClass = !filterClass || s.class_name === filterClass;
    const matchesGender = !filterGender || s.gender === filterGender;
    const matchesCategory = !filterCategory || getCategory(s.attendance_percentage || 0) === filterCategory;
    return matchesSearch && matchesClass && matchesGender && matchesCategory;
  });

  const getCategory = (percentage) => {
    if (percentage >= 90) return 'Green';
    if (percentage >= 70) return 'Orange';
    return 'Red';
  };

  const getCategoryBadge = (percentage) => {
    const category = getCategory(percentage);
    if (category === 'Green') return <span className="badge green">Green</span>;
    if (category === 'Orange') return <span className="badge orange">Orange</span>;
    return <span className="badge red">Red</span>;
  };

  const normalizeHeader = (value = '') =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const detectDelimiter = (headerLine = '') => {
    const delimiters = [',', ';', '\t'];
    return delimiters.reduce((best, delimiter) => {
      const count = headerLine.split(delimiter).length;
      return count > best.count ? { delimiter, count } : best;
    }, { delimiter: ',', count: 0 }).delimiter;
  };

  const parseDelimitedLine = (line, delimiter) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values.map((value) => value.replace(/^"|"$/g, '').trim());
  };

  const findHeaderIndex = (headers, aliases) =>
    headers.findIndex((header) => aliases.includes(normalizeHeader(header)));

  const normalizeGenderValue = (value = '') => {
    const normalized = value.trim().toLowerCase();

    if (!normalized) return 'M';
    if (['m', 'male', 'boy'].includes(normalized)) return 'M';
    if (['f', 'female', 'girl'].includes(normalized)) return 'F';

    return 'M';
  };

  const buildImportedClassName = (classValue = '', streamValue = '') => {
    const cleanClass = classValue.trim();
    const cleanStream = streamValue.trim();

    if (cleanClass && cleanStream) {
      return `${cleanClass} ${cleanStream}`.trim();
    }

    return cleanClass || cleanStream;
  };

  const generateImportedAdmissionNo = (existingAdmissionNumbers, rowNumber) => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let counter = rowNumber;
    let candidate = `IMP-${stamp}-${String(counter).padStart(4, '0')}`;

    while (existingAdmissionNumbers.has(candidate)) {
      counter += 1;
      candidate = `IMP-${stamp}-${String(counter).padStart(4, '0')}`;
    }

    existingAdmissionNumbers.add(candidate);
    return candidate;
  };

  const processImportedRows = async (rows, resetInput) => {
    if (rows.length < 2) {
      alert('❌ The file is empty or only contains headers.');
      setLoading(false);
      resetInput();
      return;
    }

    const headers = rows[0].map((value) => `${value || ''}`.trim());
    const admissionNoIndex = findHeaderIndex(headers, ['admission no', 'admission number', 'admission', 'admission no.', 'adm no', 'adm number']);
    const fullNameIndex = findHeaderIndex(headers, ['full name', 'student name', 'name', 'full_name']);
    const genderIndex = findHeaderIndex(headers, ['gender', 'sex']);
    const classIndex = findHeaderIndex(headers, ['class', 'class name', 'class_name']);
    const streamIndex = findHeaderIndex(headers, ['stream', 'section']);
    const parentNameIndex = findHeaderIndex(headers, ['parent name', 'parent', 'guardian', 'guardian name', 'parent_name']);
    const parentPhoneIndex = findHeaderIndex(headers, ['parent phone', 'parent contact', 'contact', 'phone', 'telephone', 'mobile', 'parent_phone']);
    const dobIndex = findHeaderIndex(headers, ['dob', 'date of birth', 'birth date', 'date_of_birth']);
    const notesIndex = findHeaderIndex(headers, ['notes', 'comment', 'comments', 'remarks']);

    if (fullNameIndex === -1 || classIndex === -1 || parentNameIndex === -1 || parentPhoneIndex === -1) {
      alert('❌ Import file must include at least these columns: Name, Class, Parent Name, Parent Contact. Stream is optional.');
      setLoading(false);
      resetInput();
      return;
    }

    const existingAdmissionNumbers = new Set();

    if (studentSchema.admission_no) {
      const { data: existingStudents, error: existingStudentsError } = await supabase
        .from('students')
        .select('admission_no');

      if (existingStudentsError) {
        throw existingStudentsError;
      }

      (existingStudents || [])
        .map((student) => student.admission_no)
        .filter(Boolean)
        .forEach((admissionNumber) => existingAdmissionNumbers.add(admissionNumber));
    }

    const studentsToInsert = [];
    let skippedRows = 0;

    for (let i = 1; i < rows.length; i += 1) {
      const cols = rows[i].map((value) => `${value || ''}`.trim());
      const fullName = cols[fullNameIndex]?.trim() || '';
      const className = buildImportedClassName(cols[classIndex] || '', streamIndex >= 0 ? cols[streamIndex] || '' : '');
      const parentName = cols[parentNameIndex]?.trim() || '';
      const parentPhone = cols[parentPhoneIndex]?.trim() || '';

      if (!fullName || !className || !parentName || !parentPhone) {
        skippedRows += 1;
        continue;
      }

      const suppliedAdmissionNo = studentSchema.admission_no && admissionNoIndex >= 0 ? cols[admissionNoIndex]?.trim() : '';
      const admissionNo = studentSchema.admission_no
        ? (suppliedAdmissionNo || generateImportedAdmissionNo(existingAdmissionNumbers, i))
        : '';

      if (studentSchema.admission_no && suppliedAdmissionNo) {
        if (existingAdmissionNumbers.has(suppliedAdmissionNo)) {
          skippedRows += 1;
          continue;
        }
        existingAdmissionNumbers.add(suppliedAdmissionNo);
      }

      studentsToInsert.push(buildStudentPayload({
        admission_no: admissionNo,
        full_name: fullName,
        gender: normalizeGenderValue(genderIndex >= 0 ? cols[genderIndex] || '' : ''),
        class_name: className,
        parent_name: parentName,
        parent_phone: parentPhone,
        date_of_birth: dobIndex >= 0 ? cols[dobIndex] || null : null,
        notes: notesIndex >= 0 ? cols[notesIndex] || '' : ''
      }));
    }

    if (studentsToInsert.length === 0) {
      alert('❌ No valid student records were found. Make sure your file has Name, Class, Parent Name, and Parent Contact columns.');
      setLoading(false);
      resetInput();
      return;
    }

    const { error } = await supabase
      .from('students')
      .insert(studentsToInsert);

    if (error) {
      alert('⚠️ Some records may have failed: ' + error.message);
    } else {
      const skippedMessage = skippedRows > 0 ? ` ${skippedRows} row(s) were skipped because they were incomplete or duplicates.` : '';
      alert(`✅ Successfully imported ${studentsToInsert.length} students!${skippedMessage}`);
    }

    await loadStudents();
    setLoading(false);
    resetInput();
  };

  const exportToExcel = () => {
    const dataToExport = selectedStudents.length > 0 
      ? students.filter(s => selectedStudents.includes(s.id))
      : filteredStudents;
    
    const csv = [
      ['Admission No', 'Full Name', 'Gender', 'Class', 'Parent Name', 'Parent Phone', 'DOB', 'Category'].join(','),
      ...dataToExport.map(s => [
        s.admission_no,
        s.full_name,
        s.gender,
        s.class_name,
        s.parent_name,
        s.parent_phone,
        s.date_of_birth || '',
        getCategory(s.attendance_percentage || 0)
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToPDF = () => {
    const dataToExport = selectedStudents.length > 0 
      ? students.filter(s => selectedStudents.includes(s.id))
      : filteredStudents;
    
    let pdfContent = 'JINJA COLLEGE - STUDENTS LIST\n';
    pdfContent += `Date: ${new Date().toLocaleDateString()}\n`;
    pdfContent += '='.repeat(100) + '\n\n';
    
    pdfContent += 'Admission No | Full Name | Gender | Class | Parent Name | Parent Phone | Category\n';
    pdfContent += '-'.repeat(100) + '\n';
    
    dataToExport.forEach(s => {
      pdfContent += `${s.admission_no} | ${s.full_name} | ${s.gender} | ${s.class_name} | ${s.parent_name} | ${s.parent_phone} | ${getCategory(s.attendance_percentage || 0)}\n`;
    });
    
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const resetInput = () => {
      e.target.value = '';
    };

    const fileName = file.name.toLowerCase();
    const isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        setLoading(true);

        if (isExcelFile) {
          const workbook = XLSX.read(event.target?.result, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];

          if (!firstSheetName) {
            alert('❌ The Excel file does not contain any sheet.');
            setLoading(false);
            resetInput();
            return;
          }

          const sheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            defval: ''
          });

          await processImportedRows(rows, resetInput);
        } else {
          const csv = event.target?.result || '';
          const lines = csv
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line);
          const delimiter = detectDelimiter(lines[0] || '');
          const rows = lines.map((line) => parseDelimitedLine(line, delimiter));

          await processImportedRows(rows, resetInput);
        }
      } catch (error) {
        alert('❌ Error importing file: ' + error.message);
        setLoading(false);
        resetInput();
      }
    };

    if (isExcelFile) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const bulkDelete = async () => {
    if (selectedStudents.length === 0) return;
    if (window.confirm(`Delete ${selectedStudents.length} selected students?`)) {
      await supabase.from('students').delete().in('id', selectedStudents);
      setSelectedStudents([]);
      loadStudents();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Students</h2>
        {user.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Add Student
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
        <select className="form-input" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ width: '150px' }}>
          <option value="">All Classes</option>
          {[...new Set(students.map(s => s.class_name).filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-input" value={filterGender} onChange={(e) => setFilterGender(e.target.value)} style={{ width: '120px' }}>
          <option value="">All Genders</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <select className="form-input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: '130px' }}>
          <option value="">All Categories</option>
          <option value="Green">Green</option>
          <option value="Orange">Orange</option>
          <option value="Red">Red</option>
        </select>
        <button className="btn-secondary" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
          <Download size={18} />
          Export Excel
        </button>
        <button className="btn-secondary" onClick={exportToPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
          <Download size={18} />
          Export Text
        </button>
        <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', cursor: 'pointer' }}>
          <Upload size={18} />
          Import Excel/CSV
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-gray)', fontSize: '12px', padding: '0 4px' }}>
          Accepts Excel or CSV with: Name, Class, Stream, Parent Contact. School ID is optional.
        </div>
        {selectedStudents.length > 0 && user.role === 'admin' && (
          <button className="btn-secondary" onClick={bulkDelete} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fee2e2', color: '#dc2626' }}>
            <Trash2 size={18} />
            Delete ({selectedStudents.length})
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {user.role === 'admin' && (
                <th style={{ width: '40px' }}>
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {selectedStudents.length === filteredStudents.length && filteredStudents.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
              )}
              <th>School ID</th>
              <th>Full Name</th>
              <th>Gender</th>
              <th>Class</th>
              <th>Parent Name</th>
              <th>Parent Phone</th>
              <th>Category</th>
              {user.role === 'admin' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                  Loading students...
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)' }}>
                  No students found
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => (
                <tr key={student.id}>
                  {user.role === 'admin' && (
                    <td>
                      <button onClick={() => toggleSelect(student.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {selectedStudents.includes(student.id) ? <CheckSquare size={18} color="#1e40af" /> : <Square size={18} />}
                      </button>
                    </td>
                  )}
                  <td>{getSchoolId(student, index)}</td>
                  <td style={{ fontWeight: '600' }}>{student.full_name}</td>
                  <td>{student.gender}</td>
                  <td>{student.class_name}</td>
                  <td>{student.parent_name || '-'}</td>
                  <td>{student.parent_phone}</td>
                  <td>{getCategoryBadge(student.attendance_percentage || 0)}</td>
                  {user.role === 'admin' && (
                    <td>
                      <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px' }} onClick={() => handleEdit(student)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => handleDelete(student.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingStudent(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
              <button onClick={() => { setShowModal(false); setEditingStudent(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {studentSchema.admission_no && (
              <div className="form-group">
                <label className="form-label">School ID *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.admission_no}
                  onChange={(e) => setFormData({...formData, admission_no: e.target.value})}
                  placeholder="JICO/0001"
                  required
                  disabled={editingStudent}
                />
              </div>
              )}

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="Akena Peter"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gender *</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="gender"
                      value="M"
                      checked={formData.gender === 'M'}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      required
                    />
                    Male
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="gender"
                      value="F"
                      checked={formData.gender === 'F'}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      required
                    />
                    Female
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Class/Stream *</label>
                <select
                  className="form-input"
                  value={formData.class_name}
                  onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                  required
                >
                  <option value="">Select class</option>
                  {classes.map(classItem => (
                    <React.Fragment key={classItem.id}>
                      {classItem.has_streams ? (
                        streams
                          .filter(s => s.class_id === classItem.id)
                          .map(stream => (
                            <option key={stream.id} value={`${classItem.name} ${stream.name}`}>
                              {classItem.name} {stream.name}
                            </option>
                          ))
                      ) : (
                        <option value={classItem.name}>{classItem.name} (no streams)</option>
                      )}
                    </React.Fragment>
                  ))}
                </select>
              </div>

              {studentSchema.parent_name && (
              <div className="form-group">
                <label className="form-label">Parent/Guardian Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.parent_name}
                  onChange={(e) => setFormData({...formData, parent_name: e.target.value})}
                  placeholder="Mr. Akena John"
                  required
                />
              </div>
              )}

              <div className="form-group">
                <label className="form-label">Parent Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.parent_phone}
                  onChange={(e) => setFormData({...formData, parent_phone: e.target.value})}
                  placeholder="+256701234567"
                  required
                />
              </div>

              {studentSchema.date_of_birth && (
              <div className="form-group">
                <label className="form-label">Date of Birth (Optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                />
              </div>
              )}

              {studentSchema.notes && (
              <div className="form-group">
                <label className="form-label">Additional Notes (Optional)</label>
                <textarea
                  className="form-input"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Medical conditions, special needs, etc."
                  rows="3"
                />
              </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                <Check size={18} />
                {loading ? 'Saving...' : (editingStudent ? 'Update Student' : 'Save Student')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
