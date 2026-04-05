import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, X, Check, Download, Filter, CheckSquare, Square, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';
import { matchesAnyAssignedClass, parseAssignedClasses } from '../utils/classAssignments';

export default function Students({ user }) {
  const assignedClasses = parseAssignedClasses(user.class_assigned);
  const isAdmin = user.role === 'admin';
  const canManageStudents = isAdmin;
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
  const [filterStream, setFilterStream] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [importMode, setImportMode] = useState('add');
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
            : 95
  });

  const getCategoryFromStudent = (student) => {
    if (typeof student.attendance_percentage === 'number') {
      return getCategory(student.attendance_percentage);
    }

    if (student.category === 'green') return 'Green';
    if (student.category === 'orange') return 'Orange';
    if (student.category === 'red') return 'Red';

    return 'Green';
  };

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
    if (studentSchema.attendance_percentage) {
      payload.attendance_percentage = typeof data.attendance_percentage === 'number' ? data.attendance_percentage : 95;
    }
    if (studentSchema.category) {
      payload.category = (data.category || getCategory((typeof data.attendance_percentage === 'number' ? data.attendance_percentage : 95))).toLowerCase();
    }

    return payload;
  };

  const getExistingStudentIds = async () => {
    if (!studentSchema.admission_no) return new Set();

    const { data, error } = await supabase
      .from('students')
      .select('admission_no');

    if (error) throw error;

    return new Set((data || []).map((item) => item.admission_no).filter(Boolean));
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
      const query = supabase.from('students').select('*');

      const { data, error } = await query.order(schema.full_name ? 'full_name' : 'name');
      
      if (error) throw error;

      const normalized = (data || []).map(normalizeStudentRecord);
      if (isAdmin) {
        setStudents(normalized);
      } else {
        setStudents(
          normalized.filter((student) =>
            matchesAnyAssignedClass(student.class_name || '', assignedClasses)
          )
        );
      }
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

    if (!isAdmin) {
      alert('Only admin can add or edit students.');
      return;
    }

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
        const payloadData = { ...formData };

        if (studentSchema.admission_no) {
          const existingStudentIds = await getExistingStudentIds();
          const suppliedStudentId = (payloadData.admission_no || '').trim();

          if (suppliedStudentId) {
            if (existingStudentIds.has(suppliedStudentId)) {
              alert('⚠️ Student ID already exists. Please use a different ID.');
              setLoading(false);
              return;
            }
            payloadData.admission_no = suppliedStudentId;
          } else {
            payloadData.admission_no = generateAdmissionNoFromClass(existingStudentIds, payloadData.class_name, existingStudentIds.size + 1);
          }
        }

        const { error } = await supabase.from('students').insert(buildStudentPayload(payloadData));
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
    if (!isAdmin) {
      alert('Only admin can delete students.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this student?')) {
      await supabase.from('students').delete().eq('id', id);
      loadStudents();
    }
  };

  const splitStudentClassAndStream = (value = '') => {
    const cleanValue = (value || '').trim();
    if (!cleanValue) {
      return { classPart: '', streamPart: '' };
    }

    const knownClassNames = classes
      .map((classItem) => (classItem.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    const matchedClass = knownClassNames.find(
      (className) => cleanValue === className || cleanValue.startsWith(`${className} `)
    );

    if (matchedClass) {
      const streamPart = cleanValue.slice(matchedClass.length).trim();
      return { classPart: matchedClass, streamPart };
    }

    const tokens = cleanValue.split(/\s+/).filter(Boolean);
    return {
      classPart: tokens[0] || cleanValue,
      streamPart: tokens.slice(1).join(' ')
    };
  };

  const classFilterOptions = [...new Set(
    students
      .map((student) => splitStudentClassAndStream(student.class_name).classPart)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const streamFilterOptions = [...new Set(
    students
      .filter((student) => {
        if (!filterClass) return true;
        return splitStudentClassAndStream(student.class_name).classPart === filterClass;
      })
      .map((student) => splitStudentClassAndStream(student.class_name).streamPart)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const filteredStudents = students.filter(s => {
    const classStream = splitStudentClassAndStream(s.class_name);
    const matchesSearch = (s.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.admission_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.class_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesClass = !filterClass || classStream.classPart === filterClass;
    const matchesStream = !filterStream || classStream.streamPart === filterStream;
    const matchesGender = !filterGender || s.gender === filterGender;
    const matchesCategory = !filterCategory || getCategoryFromStudent(s) === filterCategory;
    return matchesSearch && matchesClass && matchesStream && matchesGender && matchesCategory;
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

  const getCategoryBadgeForStudent = (student) => {
    const category = getCategoryFromStudent(student);
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

  const normalizeComparableValue = (value = '') =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const compactComparableValue = (value = '') =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const extractClassNumber = (value = '') => {
    const match = value.match(/\d+/);
    return match ? match[0] : '';
  };

  const looksLikeClassLabel = (value = '') => {
    const cleanValue = value.trim().toLowerCase();
    if (!cleanValue) return false;

    if (/^(s|f)\.?\s*\d+$/.test(cleanValue)) return true;
    if (/^(form|senior)\s*\d+$/.test(cleanValue)) return true;
    return false;
  };

  const splitPotentialClassAndStream = (classValue = '', streamValue = '') => {
    const cleanClass = classValue.trim();
    const cleanStream = streamValue.trim();

    if (cleanStream) {
      return { classPart: cleanClass, streamPart: cleanStream };
    }

    const classTokens = cleanClass.split(/\s+/).filter(Boolean);
    if (classTokens.length <= 1) {
      return { classPart: cleanClass, streamPart: '' };
    }

    const firstToken = classTokens[0];
    const firstTwoTokens = classTokens.slice(0, 2).join(' ');

    if (looksLikeClassLabel(firstTwoTokens) && classTokens.length > 2) {
      return {
        classPart: firstTwoTokens,
        streamPart: classTokens.slice(2).join(' ')
      };
    }

    if (looksLikeClassLabel(firstToken)) {
      return {
        classPart: firstToken,
        streamPart: classTokens.slice(1).join(' ')
      };
    }

    const lastToken = classTokens[classTokens.length - 1];
    const knownStreamExists = streams.some(
      (streamItem) => normalizeComparableValue(streamItem.name || '') === normalizeComparableValue(lastToken)
    );

    if (knownStreamExists) {
      return {
        classPart: classTokens.slice(0, -1).join(' '),
        streamPart: lastToken
      };
    }

    return { classPart: cleanClass, streamPart: '' };
  };

  const ensureClassAndStreamExist = async (rows, classIndex, streamIndex) => {
    let classesBuffer = [...classes];
    let streamsBuffer = [...streams];
    let classesCreated = 0;
    let streamsCreated = 0;
    let classUpdates = 0;

    const findClassCandidateFromBuffer = (rawClassValue = '') => {
      const normalizedInput = normalizeComparableValue(rawClassValue);
      const compactInput = compactComparableValue(rawClassValue);
      const numberInput = extractClassNumber(rawClassValue);

      if (!normalizedInput && !compactInput) {
        return null;
      }

      let fallbackByNumber = null;

      for (const classItem of classesBuffer) {
        const namesToCheck = [classItem.name || '', classItem.full_name || ''];

        for (const name of namesToCheck) {
          if (!name) continue;

          const normalizedName = normalizeComparableValue(name);
          const compactName = compactComparableValue(name);

          if (normalizedName === normalizedInput || compactName === compactInput) {
            return classItem;
          }

          if (!fallbackByNumber && numberInput && extractClassNumber(name) === numberInput) {
            fallbackByNumber = classItem;
          }
        }
      }

      return fallbackByNumber;
    };

    for (let i = 1; i < rows.length; i += 1) {
      const cols = rows[i].map((value) => `${value || ''}`.trim());
      const rawClass = cols[classIndex] || '';
      const rawStream = streamIndex >= 0 ? cols[streamIndex] || '' : '';
      const { classPart, streamPart } = splitPotentialClassAndStream(rawClass, rawStream);

      const cleanClass = classPart.trim();
      const cleanStream = streamPart.trim();
      if (!cleanClass) continue;

      let classCandidate = findClassCandidateFromBuffer(cleanClass);

      if (!classCandidate) {
        const { data: createdClass, error: createClassError } = await supabase
          .from('classes')
          .insert({
            name: cleanClass,
            full_name: cleanClass,
            has_streams: Boolean(cleanStream)
          })
          .select('*')
          .single();

        if (createClassError) {
          throw createClassError;
        }

        classCandidate = createdClass;
        classesBuffer = [...classesBuffer, createdClass];
        classesCreated += 1;
      } else if (cleanStream && !classCandidate.has_streams) {
        const { data: updatedClass, error: updateClassError } = await supabase
          .from('classes')
          .update({ has_streams: true })
          .eq('id', classCandidate.id)
          .select('*')
          .single();

        if (updateClassError) {
          throw updateClassError;
        }

        classCandidate = updatedClass;
        classesBuffer = classesBuffer.map((classItem) =>
          classItem.id === classCandidate.id ? classCandidate : classItem
        );
        classUpdates += 1;
      }

      if (!cleanStream) {
        continue;
      }

      const streamExists = streamsBuffer.some((streamItem) =>
        streamItem.class_id === classCandidate.id &&
        normalizeComparableValue(streamItem.name || '') === normalizeComparableValue(cleanStream)
      );

      if (streamExists) {
        continue;
      }

      const { data: createdStream, error: createStreamError } = await supabase
        .from('streams')
        .insert({
          class_id: classCandidate.id,
          name: cleanStream
        })
        .select('*')
        .single();

      if (createStreamError) {
        throw createStreamError;
      }

      streamsBuffer = [...streamsBuffer, createdStream];
      streamsCreated += 1;
    }

    if (classesCreated > 0 || streamsCreated > 0 || classUpdates > 0) {
      await loadClasses();
    }

    return { classesCreated, streamsCreated, classUpdates };
  };

  const findBestClassCandidate = (rawClassValue = '') => {
    const normalizedInput = normalizeComparableValue(rawClassValue);
    const compactInput = compactComparableValue(rawClassValue);
    const numberInput = extractClassNumber(rawClassValue);

    if (!normalizedInput && !compactInput) {
      return null;
    }

    let fallbackByNumber = null;

    for (const classItem of classes) {
      const namesToCheck = [classItem.name || '', classItem.full_name || ''];

      for (const name of namesToCheck) {
        if (!name) continue;

        const normalizedName = normalizeComparableValue(name);
        const compactName = compactComparableValue(name);

        if (normalizedName === normalizedInput || compactName === compactInput) {
          return classItem;
        }

        if (!fallbackByNumber && numberInput && extractClassNumber(name) === numberInput) {
          fallbackByNumber = classItem;
        }
      }
    }

    return fallbackByNumber;
  };

  const getCanonicalClassName = (classValue = '', streamValue = '') => {
    const { classPart, streamPart } = splitPotentialClassAndStream(classValue, streamValue);
    const cleanClass = classPart.trim();
    const cleanStream = streamPart.trim();

    if (!cleanClass && !cleanStream) {
      return '';
    }

    const classCandidate = findBestClassCandidate(cleanClass);

    if (classCandidate) {
      if (classCandidate.has_streams) {
        const availableStreams = streams.filter((stream) => stream.class_id === classCandidate.id);

        if (cleanStream) {
          const matchedStream = availableStreams.find(
            (stream) => normalizeComparableValue(stream.name || '') === normalizeComparableValue(cleanStream)
          );

          if (matchedStream) {
            return `${classCandidate.name} ${matchedStream.name}`.trim();
          }
        }

        if (availableStreams.length === 1) {
          return `${classCandidate.name} ${availableStreams[0].name}`.trim();
        }

        return buildImportedClassName(classCandidate.name, cleanStream);
      }

      return classCandidate.name;
    }

    const classMap = new Map();

    classes.forEach((classItem) => {
      const baseName = classItem.name || '';

      if (!baseName) return;

      if (classItem.has_streams) {
        streams
          .filter((stream) => stream.class_id === classItem.id)
          .forEach((stream) => {
            const combined = `${baseName} ${stream.name}`.trim();
            classMap.set(normalizeComparableValue(combined), combined);
          });
      } else {
        classMap.set(normalizeComparableValue(baseName), baseName);
      }
    });

    const combinedInput = buildImportedClassName(cleanClass, cleanStream);
    const directMatch = classMap.get(normalizeComparableValue(combinedInput));
    if (directMatch) {
      return directMatch;
    }

    const fromSeparateFields = classMap.get(
      normalizeComparableValue(`${cleanClass} ${cleanStream}`)
    );
    if (fromSeparateFields) {
      return fromSeparateFields;
    }

    return combinedInput;
  };

  const extractAdmissionClassCode = (classValue = '') => {
    const normalized = classValue.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const classMatch = normalized.match(/(S|F)?\d+/);

    if (classMatch) {
      const value = classMatch[0];
      if (/^[0-9]/.test(value)) return `S${value}`;
      return value;
    }

    return normalized.slice(0, 3) || 'STU';
  };

  const extractAdmissionStreamCode = (streamValue = '') => {
    const normalized = streamValue.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return normalized.slice(0, 1);
  };

  const splitClassAndStream = (className = '') => {
    const clean = className.trim();
    if (!clean) {
      return { classPart: '', streamPart: '' };
    }

    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { classPart: parts[0], streamPart: '' };
    }

    return {
      classPart: parts[0],
      streamPart: parts.slice(1).join(' ')
    };
  };

  const generateAdmissionNoFromClass = (existingAdmissionNumbers, className, rowNumber) => {
    const { classPart, streamPart } = splitClassAndStream(className);
    const classCode = extractAdmissionClassCode(classPart);
    const streamCode = extractAdmissionStreamCode(streamPart);
    const prefix = `${classCode}${streamCode}`;

    const prefixPattern = new RegExp(`^${prefix}(\\d{3})$`);
    let highestSuffix = 0;

    existingAdmissionNumbers.forEach((value) => {
      const match = value.match(prefixPattern);
      if (match) {
        highestSuffix = Math.max(highestSuffix, Number(match[1]));
      }
    });

    let nextSuffix = highestSuffix + 1;
    let candidate = `${prefix}${String(nextSuffix).padStart(3, '0')}`;

    while (existingAdmissionNumbers.has(candidate)) {
      nextSuffix += 1;
      candidate = `${prefix}${String(nextSuffix).padStart(3, '0')}`;
    }

    if (candidate.length > 18) {
      return generateImportedAdmissionNo(existingAdmissionNumbers, rowNumber);
    }

    existingAdmissionNumbers.add(candidate);
    return candidate;
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
    const admissionNoIndex = findHeaderIndex(headers, ['student id', 'studentid', 'student_id', 'admission no', 'admission number', 'admission', 'admission no.', 'adm no', 'adm number']);
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

    const ensureResult = await ensureClassAndStreamExist(rows, classIndex, streamIndex);

    const buildCompositeKey = (fullName = '', className = '', parentPhone = '') =>
      `${fullName.trim().toLowerCase()}|${className.trim().toLowerCase()}|${parentPhone.replace(/\s+/g, '')}`;

    const preparedRows = [];
    let skippedRows = 0;

    for (let i = 1; i < rows.length; i += 1) {
      const cols = rows[i].map((value) => `${value || ''}`.trim());
      const fullName = cols[fullNameIndex]?.trim() || '';
      const className = getCanonicalClassName(cols[classIndex] || '', streamIndex >= 0 ? cols[streamIndex] || '' : '');
      const parentName = cols[parentNameIndex]?.trim() || '';
      const parentPhone = cols[parentPhoneIndex]?.trim() || '';

      if (!fullName || !className || !parentName || !parentPhone) {
        skippedRows += 1;
        continue;
      }

      preparedRows.push({
        rowNumber: i,
        fullName,
        className,
        parentName,
        parentPhone,
        suppliedAdmissionNo: studentSchema.admission_no && admissionNoIndex >= 0 ? cols[admissionNoIndex]?.trim() : '',
        gender: normalizeGenderValue(genderIndex >= 0 ? cols[genderIndex] || '' : ''),
        date_of_birth: dobIndex >= 0 ? cols[dobIndex] || null : null,
        notes: notesIndex >= 0 ? cols[notesIndex] || '' : ''
      });
    }

    if (preparedRows.length === 0) {
      alert('❌ No valid student records were found. Make sure your file has Name, Class, Parent Name, and Parent Contact columns.');
      setLoading(false);
      resetInput();
      return;
    }

    if (importMode === 'replace-class') {
      const classesInImport = [...new Set(preparedRows.map((row) => row.className))];
      const previewClasses = classesInImport.slice(0, 5).join(', ');
      const moreCount = classesInImport.length > 5 ? ` and ${classesInImport.length - 5} more` : '';

      const confirmed = window.confirm(
        `Replace by class will delete current students in ${classesInImport.length} class(es): ${previewClasses}${moreCount}. Continue?`
      );

      if (!confirmed) {
        setLoading(false);
        resetInput();
        return;
      }

      let deleteResult;
      if (studentSchema.class_name) {
        deleteResult = await supabase.from('students').delete().in('class_name', classesInImport);
      } else {
        deleteResult = await supabase.from('students').delete().in('class', classesInImport);
      }

      if (deleteResult.error) {
        alert('❌ Failed to delete students for class replacement: ' + deleteResult.error.message);
        setLoading(false);
        resetInput();
        return;
      }
    }

    const existingAdmissionNumbers = new Set();
    const existingAdmissionNumbersInDb = new Set();
    const existingByAdmission = new Map();
    const existingByComposite = new Map();

    const existingFields = ['id'];
    if (studentSchema.admission_no) existingFields.push('admission_no');
    if (studentSchema.full_name) existingFields.push('full_name');
    if (studentSchema.name) existingFields.push('name');
    if (studentSchema.class_name) existingFields.push('class_name');
    if (studentSchema.class) existingFields.push('class');
    if (studentSchema.parent_phone) existingFields.push('parent_phone');

    const { data: existingStudentsAll, error: existingAllError } = await supabase
      .from('students')
      .select(existingFields.join(','));

    if (existingAllError) {
      throw existingAllError;
    }

    (existingStudentsAll || []).forEach((student) => {
      const admission = student.admission_no;
      if (admission) {
        existingAdmissionNumbers.add(admission);
        existingAdmissionNumbersInDb.add(admission);
        existingByAdmission.set(admission, student);
      }

      const key = buildCompositeKey(
        student.full_name || student.name || '',
        student.class_name || student.class || '',
        student.parent_phone || ''
      );

      if (key !== '||') {
        existingByComposite.set(key, student);
      }
    });

    const studentsToInsert = [];
    const studentsToUpdate = [];

    for (const row of preparedRows) {
      const suppliedAdmissionNo = row.suppliedAdmissionNo;
      const admissionNo = studentSchema.admission_no
        ? (suppliedAdmissionNo || generateAdmissionNoFromClass(existingAdmissionNumbers, row.className, row.rowNumber))
        : '';

      const payload = buildStudentPayload({
        admission_no: admissionNo,
        full_name: row.fullName,
        gender: row.gender,
        class_name: row.className,
        parent_name: row.parentName,
        parent_phone: row.parentPhone,
        date_of_birth: row.date_of_birth,
        notes: row.notes,
        attendance_percentage: 95,
        category: 'Green'
      });

      const compositeKey = buildCompositeKey(row.fullName, row.className, row.parentPhone);
      const matchedByAdmission = admissionNo ? existingByAdmission.get(admissionNo) : null;
      const matchedByComposite = existingByComposite.get(compositeKey);
      const matchedStudent = matchedByAdmission || matchedByComposite;

      if (studentSchema.admission_no && suppliedAdmissionNo) {
        const existsInDb = existingAdmissionNumbersInDb.has(suppliedAdmissionNo);

        if (existsInDb && importMode !== 'replace') {
          skippedRows += 1;
          continue;
        }

        existingAdmissionNumbers.add(suppliedAdmissionNo);
      }

      if (matchedStudent) {
        if (importMode === 'replace') {
          studentsToUpdate.push({ id: matchedStudent.id, payload });
        } else {
          skippedRows += 1;
        }
      } else {
        studentsToInsert.push(payload);
      }
    }

    if (studentsToInsert.length === 0 && studentsToUpdate.length === 0) {
      alert('❌ No valid student records were found. Make sure your file has Name, Class, Parent Name, and Parent Contact columns.');
      setLoading(false);
      resetInput();
      return;
    }

    let insertError = null;
    if (studentsToInsert.length > 0) {
      const { error } = await supabase
        .from('students')
        .insert(studentsToInsert);
      insertError = error;
    }

    let updatedCount = 0;
    let updateError = null;
    if (studentsToUpdate.length > 0) {
      for (const item of studentsToUpdate) {
        const { error } = await supabase
          .from('students')
          .update(item.payload)
          .eq('id', item.id);

        if (error) {
          updateError = error;
          break;
        }

        updatedCount += 1;
      }
    }

    if (insertError || updateError) {
      alert('⚠️ Some records may have failed: ' + (insertError?.message || updateError?.message));
    } else {
      const skippedMessage = skippedRows > 0 ? ` ${skippedRows} row(s) were skipped.` : '';
      const updateMessage = updatedCount > 0 ? ` ${updatedCount} record(s) replaced.` : '';
      const replacedClassMessage = importMode === 'replace-class' ? ' Class roster replacement completed.' : '';
      const classCreateMessage = ensureResult.classesCreated > 0 ? ` ${ensureResult.classesCreated} class(es) auto-created.` : '';
      const streamCreateMessage = ensureResult.streamsCreated > 0 ? ` ${ensureResult.streamsCreated} stream(s) auto-created.` : '';
      const classUpdateMessage = ensureResult.classUpdates > 0 ? ` ${ensureResult.classUpdates} class(es) updated to use streams.` : '';
      alert(`✅ Import complete. ${studentsToInsert.length} new student(s) added.${updateMessage}${skippedMessage}${replacedClassMessage}${classCreateMessage}${streamCreateMessage}${classUpdateMessage}`);
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
      ['Student ID', 'Full Name', 'Gender', 'Class', 'Parent Name', 'Parent Phone', 'DOB', 'Category'].join(','),
      ...dataToExport.map(s => [
        s.admission_no,
        s.full_name,
        s.gender,
        s.class_name,
        s.parent_name,
        s.parent_phone,
        s.date_of_birth || '',
        getCategoryFromStudent(s)
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
    
    pdfContent += 'Student ID | Full Name | Gender | Class | Parent Name | Parent Phone | Category\n';
    pdfContent += '-'.repeat(100) + '\n';
    
    dataToExport.forEach(s => {
      pdfContent += `${s.admission_no} | ${s.full_name} | ${s.gender} | ${s.class_name} | ${s.parent_name} | ${s.parent_phone} | ${getCategoryFromStudent(s)}\n`;
    });
    
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const handleImport = async (e) => {
    if (!isAdmin) {
      alert('Only admin can import students.');
      e.target.value = '';
      return;
    }

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

  const selectFilteredStudents = () => {
    setSelectedStudents(filteredStudents.map((student) => student.id));
  };

  const clearSelectedStudents = () => {
    setSelectedStudents([]);
  };

  const deleteFilteredStudents = async () => {
    if (filteredStudents.length === 0) return;

    if (window.confirm(`Delete all ${filteredStudents.length} students in current filter?`)) {
      const ids = filteredStudents.map((student) => student.id);
      await supabase.from('students').delete().in('id', ids);
      setSelectedStudents([]);
      loadStudents();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Students</h2>
        {canManageStudents && (
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
        <select
          className="form-input"
          value={filterClass}
          onChange={(e) => {
            setFilterClass(e.target.value);
            setFilterStream('');
          }}
          style={{ width: '170px' }}
        >
          <option value="">All Classes</option>
          {classFilterOptions.map((className) => <option key={className} value={className}>{className}</option>)}
        </select>
        <select className="form-input" value={filterStream} onChange={(e) => setFilterStream(e.target.value)} style={{ width: '170px' }}>
          <option value="">All Streams</option>
          {streamFilterOptions.map((streamName) => <option key={streamName} value={streamName}>{streamName}</option>)}
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
        {canManageStudents && (
          <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', cursor: 'pointer' }}>
            <Upload size={18} />
            Import Excel/CSV
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        )}
        {canManageStudents && (
          <select className="form-input" value={importMode} onChange={(e) => setImportMode(e.target.value)} style={{ width: '210px' }}>
            <option value="add">Import Mode: Add only</option>
            <option value="replace">Import Mode: Replace matching</option>
            <option value="replace-class">Import Mode: Replace by class</option>
          </select>
        )}
        {canManageStudents && (
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-gray)', fontSize: '12px', padding: '0 4px' }}>
            Accepts Excel or CSV with: Name, Class, Stream, Parent Contact. Student ID is optional (auto-generated). New students start as Green.
          </div>
        )}
        {canManageStudents && filteredStudents.length > 0 && (
          <button className="btn-secondary" onClick={selectFilteredStudents} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
            <CheckSquare size={18} />
            Select Filtered ({filteredStudents.length})
          </button>
        )}
        {canManageStudents && selectedStudents.length > 0 && (
          <button className="btn-secondary" onClick={clearSelectedStudents} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
            <Square size={18} />
            Clear Selection
          </button>
        )}
        {canManageStudents && filteredStudents.length > 0 && (
          <button className="btn-secondary" onClick={deleteFilteredStudents} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fff1f2', color: '#be123c' }}>
            <Trash2 size={18} />
            Delete Filtered
          </button>
        )}
        {selectedStudents.length > 0 && canManageStudents && (
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
              {canManageStudents && (
                <th style={{ width: '40px' }}>
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {selectedStudents.length === filteredStudents.length && filteredStudents.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </th>
              )}
              <th>Student ID</th>
              <th>Full Name</th>
              <th>Gender</th>
              <th>Class</th>
              <th>Parent Name</th>
              <th>Parent Phone</th>
              <th>Category</th>
              {canManageStudents && <th>Actions</th>}
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
              filteredStudents.map(student => (
                <tr key={student.id}>
                  {canManageStudents && (
                    <td>
                      <button onClick={() => toggleSelect(student.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {selectedStudents.includes(student.id) ? <CheckSquare size={18} color="#1e40af" /> : <Square size={18} />}
                      </button>
                    </td>
                  )}
                  <td>{student.admission_no}</td>
                  <td style={{ fontWeight: '600' }}>{student.full_name}</td>
                  <td>{student.gender}</td>
                  <td>{student.class_name}</td>
                  <td>{student.parent_name || '-'}</td>
                  <td>{student.parent_phone}</td>
                  <td>{getCategoryBadgeForStudent(student)}</td>
                  {canManageStudents && (
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
                <label className="form-label">Student ID (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.admission_no}
                  onChange={(e) => setFormData({...formData, admission_no: e.target.value})}
                  placeholder="Auto-generated if left blank"
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
                  {classes
                    .filter((classItem) => user.role === 'admin' || assignedClasses.some((assignedClass) => matchesAnyAssignedClass(assignedClass, [classItem.name])))
                    .map(classItem => (
                    <React.Fragment key={classItem.id}>
                      {classItem.has_streams ? (
                        streams
                          .filter(s => s.class_id === classItem.id)
                          .filter((stream) => user.role === 'admin' || matchesAnyAssignedClass(`${classItem.name} ${stream.name}`, assignedClasses))
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
