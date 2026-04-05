import { supabase } from './supabase';

const DEFAULT_MESSAGE = 'School system is updating... Please wait a moment.';
const DEFAULT_UPDATE_MESSAGE = 'A new version of this app is available. Please update to continue.';

const asBool = (value) => {
  const normalized = `${value ?? ''}`.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

const isMissingAppConfigTableError = (error) => {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return (
    text.includes('app_config') &&
    (
      text.includes('could not find the table') ||
      text.includes('schema cache') ||
      text.includes('does not exist') ||
      text.includes('relation')
    )
  );
};

export const loadAppUpdatingState = async () => {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'show_updating',
      'updating_message',
      'force_update',
      'minimum_supported_version',
      'update_download_url',
      'update_required_message'
    ]);

  if (error) {
    if (isMissingAppConfigTableError(error)) {
      return {
        enabled: false,
        message: DEFAULT_MESSAGE,
        forceUpdate: false,
        minimumSupportedVersion: '0.0.0',
        updateDownloadUrl: '',
        updateRequiredMessage: DEFAULT_UPDATE_MESSAGE
      };
    }
    throw error;
  }

  const map = new Map((data || []).map((row) => [row.key, row.value]));
  return {
    enabled: asBool(map.get('show_updating')),
    message: `${map.get('updating_message') || DEFAULT_MESSAGE}`,
    forceUpdate: asBool(map.get('force_update')),
    minimumSupportedVersion: `${map.get('minimum_supported_version') || '0.0.0'}`,
    updateDownloadUrl: `${map.get('update_download_url') || ''}`,
    updateRequiredMessage: `${map.get('update_required_message') || DEFAULT_UPDATE_MESSAGE}`
  };
};

const toVersionParts = (value) => {
  const normalized = `${value || ''}`
    .trim()
    .replace(/[^0-9.]/g, '')
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part || '0', 10) || 0);

  while (normalized.length < 3) normalized.push(0);
  return normalized;
};

export const isVersionBelowMinimum = (currentVersion, minimumVersion) => {
  const current = toVersionParts(currentVersion);
  const minimum = toVersionParts(minimumVersion);

  for (let i = 0; i < 3; i += 1) {
    if (current[i] < minimum[i]) return true;
    if (current[i] > minimum[i]) return false;
  }

  return false;
};
