import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local file directly to extract credentials
const envPath = path.resolve(__dirname, '../.env.local');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseKey = line.split('=')[1].trim();
    }
  }
}

console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Failed to find Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  try {
    console.log('--- Checking tables in Supabase ---');
    
    const tables = ['users', 'products', 'customers', 'bills'];
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(5);
      if (error) {
        console.error(`❌ Error fetching ${table}:`, error.message);
      } else {
        console.log(`\n✅ Table '${table}': found ${data.length} records (limit 5):`);
        if (data.length > 0) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log('  (Empty table)');
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkData();
