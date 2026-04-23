
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function checkConvoProfiles() {
  const userId = '12765712-1042-41bb-93bf-864cee2db2be'; // NageshSY
  console.log('Checking conversations for user:', userId);
  
  const { data: convos, error: err1 } = await supabase
    .from('conversations')
    .select('*')
    .contains('participants', [userId]);
    
  if (err1) return console.error('Error fetching convos:', err1);
  
  console.log(`Found ${convos.length} conversations.`);
  
  for (const convo of convos) {
    const otherId = convo.participants.find(p => p !== userId);
    if (otherId) {
      const { data: profile, error: err2 } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherId)
        .maybeSingle();
        
      console.log(`Convo ${convo.id}: Other User ${otherId}`);
      if (profile) {
        console.log(`  Profile found: Name="${profile.full_name}", Username="${profile.username}", Avatar="${profile.avatar_url}"`);
      } else {
        console.log('  PROFILE MISSING IN DATABASE!');
        // Try looking in 'user' table as a backup
        const { data: userTable } = await supabase.from('user').select('*').eq('id', otherId).maybeSingle();
        if (userTable) {
           console.log(`  Found in 'user' table instead: Name="${userTable.full_name}"`);
        }
      }
    }
  }
}

checkConvoProfiles();
