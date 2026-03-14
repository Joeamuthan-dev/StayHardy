
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUsers() {
  console.log('Checking connection to:', supabaseUrl);
  
  const { data: users, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users found in public.users:', users.length);
    users.forEach(u => console.log(`- ${u.email} (ID: ${u.id}, Role: ${u.role})`));
  }

  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
  // Note: listing auth users requires service role key, which we don't have.
  // We can only check the public.users table.
}

checkUsers();
