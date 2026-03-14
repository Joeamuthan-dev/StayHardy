
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('Checking users table structure...');
  const { data, error } = await supabase.from('users').select('*').limit(1);
  
  if (error) {
    console.error('Error fetching users:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('User columns:', Object.keys(data[0]));
  } else {
    console.log('No users found to inspect. Attempting to get table info via RPC or descriptive error...');
    const { error: insertError } = await supabase.from('users').insert([{ id: '00000000-0000-0000-0000-000000000000', test_col: 'test' }]);
    console.log('Insert error msg (to find valid columns):', insertError?.message);
  }
}

inspectSchema();
