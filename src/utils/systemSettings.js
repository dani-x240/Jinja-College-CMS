import { supabase } from './supabase';

const isMissingSystemSettingsTableError = (error) => {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return (
    text.includes('system_settings') &&
    (
      text.includes('could not find the table') ||
      text.includes('schema cache') ||
      text.includes('does not exist') ||
      text.includes('relation')
    )
  );
};

const MISSING_SETTINGS_TABLE_MESSAGE = 'Settings storage is not set up yet. Using default settings for now.';

export const SETTINGS_DEFINITIONS = [
  { field: 'schoolName', category: 'school', key: 'school_name', defaultValue: 'Jinja College' },
  { field: 'schoolAddress', category: 'school', key: 'school_address', defaultValue: 'P.O. Box 211, Jinja, Uganda' },
  { field: 'schoolPhone', category: 'school', key: 'school_phone', defaultValue: '+256434120571' },
  { field: 'schoolEmail', category: 'school', key: 'school_email', defaultValue: 'info@jinjacollege.ug' },
  { field: 'schoolMotto', category: 'school', key: 'school_motto', defaultValue: 'Strive to Excel' },
  { field: 'attendanceWindowStart', category: 'attendance', key: 'marking_window_start', defaultValue: '07:00' },
  { field: 'attendanceWindowEnd', category: 'attendance', key: 'marking_window_end', defaultValue: '09:00' },
  { field: 'greenThreshold', category: 'attendance', key: 'green_threshold', defaultValue: '90' },
  { field: 'orangeThreshold', category: 'attendance', key: 'orange_threshold', defaultValue: '70' },
  { field: 'redThreshold', category: 'attendance', key: 'red_threshold', defaultValue: '70' },
  { field: 'consecutiveAbsences', category: 'attendance', key: 'consecutive_absences_flag', defaultValue: '5' },
  { field: 'smsProvider', category: 'sms', key: 'provider', defaultValue: "Africa's Talking" },
  { field: 'senderID', category: 'sms', key: 'sender_id', defaultValue: 'JINJACOL' },
  { field: 'reportDay', category: 'reporting', key: 'weekly_report_day', defaultValue: 'Friday' },
  { field: 'reportDeadline', category: 'reporting', key: 'deadline_time', defaultValue: '17:00' },
  { field: 'dutyDuration', category: 'duty', key: 'default_duration', defaultValue: 'One Week' },
  { field: 'maxTeamSize', category: 'duty', key: 'max_team_size', defaultValue: '5' },
  { field: 'minTeamSize', category: 'duty', key: 'min_team_size', defaultValue: '1' },
  { field: 'autoTeacherToClassDays', category: 'reporting', key: 'auto_teacher_to_class_days', defaultValue: '1' },
  { field: 'autoClassToDutyDays', category: 'reporting', key: 'auto_class_to_duty_days', defaultValue: '2' },
  { field: 'autoDutyToAdminDays', category: 'reporting', key: 'auto_duty_to_admin_days', defaultValue: '3' }
];

const asLookupKey = (category, key) => `${category}:${key}`;

export const getDefaultSettingsState = () =>
  SETTINGS_DEFINITIONS.reduce((acc, item) => {
    acc[item.field] = item.defaultValue;
    return acc;
  }, {});

export const loadSystemSettings = async () => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('category, setting_key, setting_value');

  if (error) {
    if (isMissingSystemSettingsTableError(error)) {
      return getDefaultSettingsState();
    }
    throw error;
  }

  const lookup = new Map((data || []).map((row) => [asLookupKey(row.category, row.setting_key), row.setting_value]));
  const defaults = getDefaultSettingsState();

  return SETTINGS_DEFINITIONS.reduce((acc, item) => {
    const foundValue = lookup.get(asLookupKey(item.category, item.key));
    acc[item.field] = foundValue ?? defaults[item.field];
    return acc;
  }, { ...defaults });
};

export const saveSystemSettings = async (settingsState, userId) => {
  const payload = SETTINGS_DEFINITIONS.map((item) => ({
    category: item.category,
    setting_key: item.key,
    setting_value: `${settingsState[item.field] ?? item.defaultValue}`,
    updated_by: `${userId || ''}` || null
  }));

  const { error } = await supabase
    .from('system_settings')
    .upsert(payload, { onConflict: 'category,setting_key' });

  if (error) {
    if (isMissingSystemSettingsTableError(error)) {
      throw new Error(MISSING_SETTINGS_TABLE_MESSAGE);
    }
    throw error;
  }
};

export const getAutoSubmissionDurations = (settingsState = {}) => {
  const safeInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(`${value ?? ''}`, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(parsed, 0);
  };

  return {
    teacherToClassDays: safeInt(settingsState.autoTeacherToClassDays, 1),
    classToDutyDays: safeInt(settingsState.autoClassToDutyDays, 2),
    dutyToAdminDays: safeInt(settingsState.autoDutyToAdminDays, 3)
  };
};
