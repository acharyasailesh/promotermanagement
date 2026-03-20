const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const lines = env.split('\n');

let url = '';
let key = '';

lines.forEach(l => {
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = l.split('=')[1].trim();
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = l.split('=')[1].trim();
});

console.log('URL:', url);

const supabase = createClient(url, key);

async function test() {
  console.log('Fetching...');
  const { data: shs, error: e1 } = await supabase
    .from('shareholders')
    .select('id, first_name, last_name, nominees(*)')
    .is('deleted_at', null);
    
  if (e1) {
    console.error('Shareholders Nominee Fetch Error:', e1);
    return;
  }
  
  if (!shs || shs.length === 0) return console.log('No shareholders found');

  shs.forEach(s => {
    console.log(`Shareholder: ${s.first_name} ${s.last_name} [${s.id}]`);
    console.log('Nominees:', s.nominees);
  });
}

test();
