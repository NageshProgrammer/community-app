
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const POST_SELECT = '*, author:profiles!author_id(*), likes_count, comments_count, reposts_count';

async function testProfile() {
  const targetId = 'be283dc8-912e-4dc4-8792-3981309ddbf1'; // The user from check-schema
  console.log('Testing profile fetch for:', targetId);

  const [profileRes, postsRes, repostsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', targetId).maybeSingle(),
    supabase.from('posts').select(POST_SELECT).eq('author_id', targetId),
    supabase.from('post_reposts').select('posts(' + POST_SELECT + ')').eq('user_id', targetId),
  ]);

  console.log('Profile found:', !!profileRes.data);
  console.log('Posts count:', postsRes.data?.length || 0);
  console.log('Reposts raw data:', JSON.stringify(repostsRes.data, null, 2));
  
  const mappedReposts = (repostsRes.data || []).map((r) => r.posts).filter(Boolean);
  console.log('Mapped Reposts count:', mappedReposts.length);
  if (mappedReposts.length > 0) {
    console.log('First Repost ID:', mappedReposts[0].id);
    console.log('First Repost Author:', mappedReposts[0].author);
  }
}

testProfile();
