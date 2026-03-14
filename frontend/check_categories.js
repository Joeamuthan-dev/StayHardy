import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('/Users/joeamuthan/.gemini/antigravity/scratch/MyBoard/frontend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  // We can't easily list tables with the anon key usually, but we can try to select from a hypothetical 'categories' table.
  const { error } = await supabase
    .from('categories')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Categories table likely does NOT exist or access denied:', error.message);
  } else {
    console.log('Categories table exists.');
  }
}

checkTables();
