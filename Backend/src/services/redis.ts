import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('⚠️ Upstash Redis environment variables are missing!');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Keys for our aggregator
export const REDIS_KEYS = {
  PENDING_ACTIONS: 'community:pending_actions',
  FEED_CACHE: 'community:feed_cache',
  // Per-user caches (TTL: 60s) — prevents DB hammering at scale
  userBootstrap: (uid: string) => `community:bootstrap:${uid}`,
  userInteractions: (uid: string) => `community:interactions:${uid}`,
  userConversations: (uid: string) => `community:convos:${uid}`,
  userNotifications: (uid: string) => `community:notifs:${uid}`,
  userFollowing: (uid: string) => `community:following:${uid}`,
};
