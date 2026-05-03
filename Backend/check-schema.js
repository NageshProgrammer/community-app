
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

  console.log('\nChecking posts table...');
  const { data: post, error: err5 } = await supabase.from('posts').select('*').limit(1);
  console.log('Posts Result:', post, err5);

  console.log('\nChecking conversations table...');
  const { data: conv, error: err6 } = await supabase.from('conversations').select('*').limit(1);
  console.log('Conversations Result:', conv, err6);

  console.log('\nChecking post_reposts table...');
  const { data: repr, error: err7 } = await supabase.from('post_reposts').select('*').limit(1);
  console.log('Post Reposts Result:', repr, err7);

  const POST_SELECT = '*, author:profiles!author_id(*), likes_count, comments_count, reposts_count';
  console.log('\nTesting POST_SELECT query...');
  const { data: postSelect, error: err8 } = await supabase.from('posts').select(POST_SELECT).limit(1);
  console.log('POST_SELECT Result:', postSelect, err8);

  console.log('\nTesting profile reposts query...');
  const { data: profileReposts, error: err9 } = await supabase.from('post_reposts').select('*, posts(*)').limit(1);
  console.log('Profile Reposts Result (posts(*)):', profileReposts, err9);

  console.log('\nTesting profile reposts query (posts!post_id(*))...');
  const { data: profileReposts2, error: err10 } = await supabase.from('post_reposts').select('*, posts!post_id(*)').limit(1);
  console.log('Profile Reposts Result (posts!post_id(*)):', profileReposts2, err10);

  console.log('\nTesting NESTED profile reposts query...');
  const { data: profileReposts3, error: err11 } = await supabase.from('post_reposts').select('posts(' + POST_SELECT + ')').limit(1);
  console.log('Nested Reposts Result:', profileReposts3, err11);
}

checkSchema();
