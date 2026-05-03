
const { Redis } = require('@upstash/redis');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function checkRedis() {
  const feed = await redis.get('community:feed_cache');
  console.log('Feed Cache in Redis:', feed ? `Found ${feed.length} posts` : 'Empty');
  
  const actions = await redis.lrange('community:pending_actions', 0, -1);
  console.log('Pending Actions:', actions.length);
  
  if (feed === null || feed.length === 0) {
    console.log('Clearing cache to force refresh...');
    await redis.del('community:feed_cache');
  }
}

checkRedis();
