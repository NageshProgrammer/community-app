
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

const POST_SELECT = '*, author:profiles!author_id(*), likes_count, comments_count, reposts_count';

async function testFetch() {
  console.log('Testing full POST_SELECT query...');
  const { data, error } = await supabase.from('posts').select(POST_SELECT).limit(1);
  if (error) {
    console.error('FETCH ERROR:', error.message);
    console.error('Error Details:', error.details);
    console.error('Error Hint:', error.hint);
  } else {
    console.log('Fetch Success! Sample Post:', JSON.stringify(data[0], null, 2));
  }
}

testFetch();
