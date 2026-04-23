
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

const POST_SELECT = '*, author:profiles!author_id(*), likes_count, comments_count, reposts_count';

async function testReposts() {
  const targetUserId = '12765712-1042-41bb-93bf-864cee2db2be'; // NageshSY's ID from previous test
  console.log(`Testing reposts fetch for user ${targetUserId}...`);
  
  const { data, error } = await supabase
    .from('post_reposts')
    .select('posts(' + POST_SELECT + ')')
    .eq('user_id', targetUserId);
    
  if (error) {
    console.error('REPOSTS ERROR:', error.message);
  } else {
    console.log('Reposts Results:', JSON.stringify(data, null, 2));
  }
}

testReposts();
