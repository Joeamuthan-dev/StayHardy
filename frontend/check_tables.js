
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    // List tables (heuristic: try to select from likely names)
    const tables = ['users', 'tasks', 'tickets', 'feedback'];
    for (const table of tables) {
        const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (!error) {
            console.log(`Table '${table}' exists: ${count} rows`);
        } else {
            console.log(`Table '${table}' error: ${error.message}`);
        }
    }
}

checkTables();
