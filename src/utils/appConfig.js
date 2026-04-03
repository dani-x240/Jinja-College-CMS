import { supabase } from './supabase';

export const fetchAppConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.warn('Failed to fetch app config:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error fetching app config:', err);
    return null;
  }
};
