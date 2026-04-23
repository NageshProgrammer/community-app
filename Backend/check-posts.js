
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function checkPosts() {
  console.log('Checking posts table columns...');
  const { data, error } = await supabase.from('posts').select('*').limit(1);
  if (error) {
    console.error('Error fetching posts:', error);
  } else if (data && data.length > 0) {
    console.log('Sample Post Columns:', Object.keys(data[0]));
  } else {
    console.log('No posts found to check schema.');
  }
}

checkPosts();
