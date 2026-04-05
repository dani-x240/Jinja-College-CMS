import { supabase } from './supabase';
import { classMatches, parseAssignedClasses } from './classAssignments';

// Auto-expire duties that have passed their end date
export const expireOldDuties = async () => {
  const today = new Date().toISOString().split('T')[0];
  
  const { error } = await supabase
    .from('duty_assignments')
    .update({ status: 'expired' })
    .lt('end_date', today)
    .eq('status', 'active');
  
  if (error) {
    console.error('Error expiring duties:', error);
  }
};

// Check if teacher has active duty
export const checkTeacherDuty = async (teacherId) => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('duty_assignments')
    .select('is_duty_head')
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)
    .single();
  
  if (error || !data) {
    return { hasDuty: false, isDutyHead: false };
  }
  
  return { hasDuty: true, isDutyHead: data.is_duty_head };
};

// Get fresh teacher data with all assignments
export const getTeacherWithAssignments = async (teacherId) => {
  // First expire old duties
  await expireOldDuties();
  
  // Get teacher data
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .single();
  
  if (teacherError || !teacher) {
    return null;
  }
  
  // Check duty status
  const dutyStatus = await checkTeacherDuty(teacherId);
  
  return {
    ...teacher,
    has_duty: dutyStatus.hasDuty,
    is_duty_head: dutyStatus.isDutyHead
  };
};

// Validate class assignment
export const validateClassAssignment = async (className) => {
  if (!className) return true; // Empty is valid (no assignment)

  const trimmedClassName = className.trim();
  if (!trimmedClassName) return true;

  const [{ data: classesData }, { data: streamsData }] = await Promise.all([
    supabase.from('classes').select('id, name'),
    supabase.from('streams').select('id, class_id, name')
  ]);

  const classes = classesData || [];
  const streams = streamsData || [];

  if (classes.some((classItem) => classMatches(classItem.name || '', trimmedClassName))) {
    return true;
  }

  for (const stream of streams) {
    const classItem = classes.find((item) => item.id === stream.class_id);
    if (!classItem) continue;

    const streamLabel = `${classItem.name} ${stream.name}`.trim();
    if (classMatches(streamLabel, trimmedClassName)) {
      return true;
    }
  }

  return false;
};

// Check if class is already assigned to another teacher
export const isClassAlreadyAssigned = async (className, excludeTeacherId = null) => {
  if (!className) return false;

  let query = supabase
    .from('teachers')
    .select('id, class_assigned');
  
  if (excludeTeacherId) {
    query = query.neq('id', excludeTeacherId);
  }
  
  const { data, error } = await query;

  if (error || !data) {
    return false;
  }

  return data.some((teacher) =>
    parseAssignedClasses(teacher.class_assigned).some((assignedClass) => classMatches(assignedClass, className))
  );
};
