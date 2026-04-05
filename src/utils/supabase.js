import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
	process.env.REACT_APP_SUPABASE_URL ||
	'https://hjhkvjysynpseixutvkw.supabase.co';

const supabaseAnonKey =
	process.env.REACT_APP_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaGt2anlzeW5wc2VpeHV0dmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjI4MTYsImV4cCI6MjA4NzkzODgxNn0.K--B53lH5o5sX0ABBUgZdzAiHrr86V9mh34sBNuhr6I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
