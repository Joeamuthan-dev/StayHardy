
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAvatarColumn() {
    const { error } = await supabase.from('users').update({ avatar_url: 'test' }).match({ id: 'non-existent' });
    if (error && error.message.includes('column "avatar_url" of relation "users" does not exist')) {
        console.log('Column avatar_url does NOT exist');
    } else if (error) {
        console.log('Error (but column might exist):', error.message);
    } else {
        console.log('Column avatar_url likely EXISTS');
    }
}

checkAvatarColumn();
