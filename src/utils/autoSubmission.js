import { supabase } from './supabase';
import { classMatches } from './classAssignments';
import { getAutoSubmissionDurations, loadSystemSettings } from './systemSettings';

const AUTO_SUBMISSION_LAST_RUN_KEY = 'cms.autoSubmission.lastRunMs';
const AUTO_SUBMISSION_MIN_INTERVAL_MS = 2 * 60 * 1000;

const toDateStringDaysAgo = (days) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - Math.max(days, 0));
  return now.toISOString().split('T')[0];
};

const parseIsoDate = (value) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const findClassTeacher = (teachers, className) => {
  return (teachers || []).find((teacher) => classMatches(className, teacher.class_teacher_assigned || ''));
};

const getActiveDutyHead = async () => {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('duty_assignments')
    .select('teacher_id, teachers(name)')
    .eq('status', 'active')
    .eq('is_duty_head', true)
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(1)
    .maybeSingle();

  if (data?.teacher_id) {
    return {
      id: String(data.teacher_id),
      name: data.teachers?.name || 'Duty Head'
    };
  }

  return null;
};

const getFallbackDutyHead = async () => {
  const activeHead = await getActiveDutyHead();
  if (activeHead) return activeHead;

  const { data } = await supabase
    .from('teachers')
    .select('id, name')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;

  return {
    id: String(data.id),
    name: data.name || 'Admin'
  };
};

const autoForwardClassToDuty = async ({ teacherToClassDays, classToDutyDays }) => {
  const totalWaitDays = Math.max(teacherToClassDays, 0) + Math.max(classToDutyDays, 0);
  const cutoffDate = toDateStringDaysAgo(totalWaitDays);

  const [lessonRes, streamRes, teachersRes] = await Promise.all([
    supabase
      .schema('public')
      .from('lesson_reports')
      .select('id, class_name, report_date, created_at, subject, participation')
      .lte('report_date', cutoffDate)
      .order('created_at', { ascending: true }),
    supabase
      .schema('public')
      .from('stream_reports')
      .select('id, class_name, created_at'),
    supabase
      .from('teachers')
      .select('id, name, class_teacher_assigned')
      .not('class_teacher_assigned', 'is', null)
  ]);

  const lessons = lessonRes.data || [];
  const streamReports = streamRes.data || [];
  const classTeachers = teachersRes.data || [];

  if (lessons.length === 0 || classTeachers.length === 0) {
    return 0;
  }

  const activeDutyHead = await getActiveDutyHead();

  const lastStreamCreatedByClass = streamReports.reduce((acc, row) => {
    const className = row.class_name || '';
    if (!className) return acc;
    const current = acc[className] || 0;
    const next = parseIsoDate(row.created_at);
    if (next > current) acc[className] = next;
    return acc;
  }, {});

  const lessonsByClass = lessons.reduce((acc, row) => {
    const className = row.class_name || '';
    if (!className) return acc;
    if (!acc[className]) acc[className] = [];
    acc[className].push(row);
    return acc;
  }, {});

  let created = 0;

  for (const [className, classLessons] of Object.entries(lessonsByClass)) {
    const classTeacher = findClassTeacher(classTeachers, className);
    if (!classTeacher?.id) continue;

    const lastForwardedMs = lastStreamCreatedByClass[className] || 0;
    const pendingLessons = classLessons.filter((lesson) => parseIsoDate(lesson.created_at) > lastForwardedMs);

    if (pendingLessons.length === 0) continue;

    const poorParticipationCount = pendingLessons.filter(
      (lesson) => ['poor', 'fair'].includes(`${lesson.participation || ''}`.toLowerCase())
    ).length;

    const subjectList = [...new Set(pendingLessons.map((lesson) => lesson.subject).filter(Boolean))]
      .slice(0, 6)
      .join(', ');

    const payload = {
      teacher_id: String(classTeacher.id),
      teacher_name: `${classTeacher.name || 'Class Teacher'} (Auto)` ,
      class_name: className,
      summary: `Auto-submitted by system after ${totalWaitDays} day(s). ${pendingLessons.length} teacher report(s) escalated for ${className}. Subjects: ${subjectList || 'N/A'}.`,
      total_reports: pendingLessons.length,
      red_students: poorParticipationCount,
      report_date: new Date().toISOString().split('T')[0],
      status: 'submitted'
    };

    // Include detailed lesson info so auto-submitted reports contain full context
    try {
      payload.lessons = JSON.stringify(pendingLessons.map(l => ({ subject: l.subject || null, report_date: l.report_date || null, created_at: l.created_at || null, participation: l.participation || null })));
    } catch (e) {
      payload.lessons = null;
    }

    if (activeDutyHead?.id) {
      payload.duty_head_id = activeDutyHead.id;
      payload.duty_head_name = activeDutyHead.name;
    }

    let { error } = await supabase.schema('public').from('stream_reports').insert(payload);

    if (error) {
      const text = `${error.message || ''}`.toLowerCase();
      if (text.includes('column') && (text.includes('duty_head_id') || text.includes('duty_head_name'))) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.duty_head_id;
        delete fallbackPayload.duty_head_name;
        const fallback = await supabase.schema('public').from('stream_reports').insert(fallbackPayload);
        error = fallback.error;
      }
    }

    if (!error) {
      created += 1;
    }
  }

  return created;
};

const autoForwardDutyToAdmin = async ({ dutyToAdminDays }) => {
  const cutoffDate = toDateStringDaysAgo(Math.max(dutyToAdminDays, 0));

  const [streamRes, consolidatedRes] = await Promise.all([
    supabase
      .schema('public')
      .from('stream_reports')
      .select('id, class_name, red_students, created_at, report_date')
      .lte('report_date', cutoffDate)
      .order('created_at', { ascending: true }),
    supabase
      .schema('public')
      .from('consolidated_reports')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
  ]);

  const streamReports = streamRes.data || [];
  if (streamReports.length === 0) return 0;

  const lastConsolidatedCreatedAt = parseIsoDate(consolidatedRes.data?.[0]?.created_at);
  const pending = streamReports.filter((row) => parseIsoDate(row.created_at) > lastConsolidatedCreatedAt);

  if (pending.length === 0) return 0;

  const dutyHead = await getFallbackDutyHead();
  if (!dutyHead?.id) return 0;

  const uniqueClasses = [...new Set(pending.map((item) => item.class_name).filter(Boolean))];
  const totalRedStudents = pending.reduce((sum, row) => sum + Number(row.red_students || 0), 0);

  const payload = {
    duty_head_id: dutyHead.id,
    duty_head_name: `${dutyHead.name} (Auto)`,
    week_start: new Date().toISOString().split('T')[0],
    total_stream_reports: pending.length,
    total_red_students: totalRedStudents,
    consolidated_notes: `Auto-submitted by system after ${dutyToAdminDays} day(s). Included ${pending.length} stream report(s) from ${uniqueClasses.join(', ') || 'multiple classes'}.`,
    status: 'submitted'
  };

  const { error } = await supabase.schema('public').from('consolidated_reports').insert(payload);

  return error ? 0 : 1;
};

export const runAutoSubmissionPipeline = async () => {
  const nowMs = Date.now();
  const lastRunMs = Number(localStorage.getItem(AUTO_SUBMISSION_LAST_RUN_KEY) || 0);

  if (nowMs - lastRunMs < AUTO_SUBMISSION_MIN_INTERVAL_MS) {
    return { skipped: true, reason: 'throttled' };
  }

  const settingsState = await loadSystemSettings();
  const durations = getAutoSubmissionDurations(settingsState);

  const classToDutyCreated = await autoForwardClassToDuty(durations);
  const dutyToAdminCreated = await autoForwardDutyToAdmin(durations);

  localStorage.setItem(AUTO_SUBMISSION_LAST_RUN_KEY, `${nowMs}`);

  return {
    skipped: false,
    classToDutyCreated,
    dutyToAdminCreated,
    durations
  };
};
