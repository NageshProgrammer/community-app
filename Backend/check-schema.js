
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSchema() {
  console.log('Checking notifications table...');
  const { data: notif, error: err1 } = await supabase.from('notifications').select('*').limit(1);
  console.log('Notifications Result:', notif, err1);

  console.log('\nChecking table schemas via SQL RPC...');
  // We can use RPC to check schema if we have it, but let's try direct table info via Supabase if possible
  // Alternatively, just try a query that uses the specific operators we care about

  console.log('\nChecking messages table...');
  const { data: msg, error: err3 } = await supabase.from('messages').select('*').limit(1);
  console.log('Messages Result:', msg, err3);

  console.log('\nChecking profiles table...');
  const { data: prof, error: err4 } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles Result:', prof, err4);
}

checkSchema();
