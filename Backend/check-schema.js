
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSchema() {
  console.log('Checking notifications table...');
  const { data: notif, error: err1 } = await supabase.from('notifications').select('*').limit(1);
  console.log('Notifications Result:', notif, err1);

  console.log('\nChecking conversations table...');
  const { data: conv, error: err2 } = await supabase.from('conversations').select('*').limit(1);
  console.log('Conversations Result:', conv, err2);
}

checkSchema();
