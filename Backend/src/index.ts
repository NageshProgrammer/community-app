import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { supabase } from './supabase';
import { qstashReceiver } from './services/qstash';
import { redis, REDIS_KEYS } from './services/redis';
import { emitActivity, getConsumer, TOPICS, isKafkaAvailable } from './services/kafka';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: true },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const getUserId = (req: express.Request) => req.headers['x-user-id'] as string;

// ===== BULK PROCESSOR ENGINE =====
const processEventBulk = async (userId: string, type: string, payload: any) => {
  try {
    switch (type) {
      case 'LIKE': {
        const { postId, action } = payload;
        if (action === 'add' || action === 'toggle') {
          const { error } = await supabase.from('post_likes').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
          if (!error) await supabase.rpc('increment_likes', { p_id: postId });
        } else {
          const { error } = await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
          if (!error) await supabase.rpc('decrement_likes', { p_id: postId });
        }
        break;
      }
      case 'REPOST': {
        const { postId, action } = payload;
        if (action === 'add' || action === 'toggle') {
          const { error } = await supabase.from('post_reposts').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
          if (!error) await supabase.rpc('increment_reposts', { p_id: postId });
        } else {
          const { error } = await supabase.from('post_reposts').delete().match({ post_id: postId, user_id: userId });
          if (!error) await supabase.rpc('decrement_reposts', { p_id: postId });
        }
        break;
      }
      case 'COMMENT': {
        const { postId, content } = payload;
        await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, content });
        await supabase.rpc('increment_comments', { p_id: postId });
        break;
      }
      case 'POST': {
        const { content, image, location, repostedPostId } = payload;
        await supabase.from('posts').insert({ author_id: userId, content, image, location, reposted_post_id: repostedPostId });
        break;
      }
      case 'MESSAGE': {
        const { conversationId, text, imageUrl, voiceUrl, replyToId, timestamp } = payload;
        const { data: msg } = await supabase.from('messages').insert({
          conversationid: conversationId, senderid: userId, text, image_url: imageUrl, voice_url: voiceUrl, reply_to_id: replyToId, timestamp: timestamp || new Date().toISOString()
        }).select('*, author:profiles!senderid(*)').single();
        if (msg) {
          await supabase.from('conversations').update({ lastmessage: text || (imageUrl ? '📷 Photo' : voiceUrl ? '🎤 Voice message' : ''), updatedat: msg.timestamp }).eq('id', conversationId);
          io.to(conversationId).emit('new_message', { ...msg, senderId: msg.senderid });
          
          // NOTIFICATION for message (notifies all other participants)
          const { data: convo } = await supabase.from('conversations').select('participants').eq('id', conversationId).single();
          const others = (convo?.participants || []).filter((p: string) => p !== userId);
          if (others.length > 0) {
            const notifs = others.map((targetId: string) => ({
              user_id: targetId,
              senderid: userId,
              type: 'message',
              message: text || 'Sent a photo',
              is_read: false
            }));
            await supabase.from('notifications').insert(notifs);
          }
        }
        break;
      }
      case 'FOLLOW': {
        const { targetId, action } = payload;
        if (action === 'follow') {
          await supabase.from('follows').upsert({ follower_id: userId, following_user_id: targetId }, { onConflict: 'follower_id,following_user_id' });
          // NOTIFICATION for follow
          await supabase.from('notifications').insert({
            user_id: targetId,
            senderid: userId,
            type: 'follow',
            message: 'Started following you',
            is_read: false
          });
        } else {
          await supabase.from('follows').delete().match({ follower_id: userId, following_user_id: targetId });
        }
        break;
      }
      case 'MESSAGE_UPDATE': {
        const { action, messageId, text, conversationId } = payload;
        if (action === 'edit') {
          await supabase.from('messages').update({ text, is_edited: true }).eq('id', messageId).eq('senderid', userId);
          if (conversationId) io.to(conversationId).emit('message_edited', { messageId, text });
          else io.emit('message_edited', { messageId, text }); // Fallback broadcast
        } else if (action === 'delete') {
          await supabase.from('messages').delete().eq('id', messageId).eq('senderid', userId);
          if (conversationId) io.to(conversationId).emit('message_deleted', { messageId });
          else io.emit('message_deleted', { messageId }); // Fallback broadcast
        }
        break;
      }
      case 'BLOCK': {
        const { targetId, action } = payload;
        if (action === 'block') {
          await supabase.from('blocks').upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' });
        } else {
          await supabase.from('blocks').delete().match({ blocker_id: userId, blocked_id: targetId });
        }
        break;
      }
    }
  } catch (e) { console.error(`Item Error (${type}):`, e); }
};

// ===== API ROUTES =====
const POST_SELECT = '*, author:profiles!author_id(*), likes_count, comments_count, reposts_count';

app.get('/api/bootstrap', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [profileRes, convRes, notifRes, postsRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('conversations').select('*').contains('participants', [userId]).order('updatedat', { ascending: false }).limit(20),
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(20),
      supabase.from('follows').select('following_user_id').eq('follower_id', userId)
    ]);
    res.json({ 
      profile: profileRes.data, 
      notifications: notifRes.data || [], 
      posts: postsRes.data || [], 
      following: (followRes.data || []).map((f: any) => f.following_user_id),
      conversations: await enrichConversations(convRes.data || [], userId)
    });
  } catch (err) { res.status(500).json({ error: 'Bootstrap failed' }); }
});

async function enrichConversations(convos: any[], userId: string) {
  if (!userId) return convos;
  return await Promise.all(convos.map(async (convo) => {
    try {
      // Use case-insensitive comparison for IDs
      const otherId = convo.participants?.find((p: string) => p.toLowerCase() !== userId.toLowerCase());
      let profile = null;
      if (otherId) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', otherId).maybeSingle();
        if (profileData) {
          profile = {
            ...profileData,
            display_name: profileData.full_name || profileData.username || 'User',
            initial: (profileData.full_name || profileData.username || 'U').substring(0, 1).toUpperCase()
          };
        }
      }
      
      const { count } = await supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversationid', convo.id)
        .eq('isread', false)
        .neq('senderid', userId);
        
      return { ...convo, profile, unreadCount: count || 0 };
    } catch (innerErr) {
      console.error(`Error enriching conversation ${convo.id}:`, innerErr);
      return { ...convo, profile: null, unreadCount: 0 };
    }
  }));
}

app.get('/api/posts', async (req, res) => {
  try {
    const cachedFeed = await redis.get(REDIS_KEYS.FEED_CACHE);
    if (cachedFeed) return res.json(cachedFeed);
    const { data, error } = await supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    await redis.set(REDIS_KEYS.FEED_CACHE, data, { ex: 60 });
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/conversations', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabase.from('conversations').select('*').contains('participants', [userId]).order('updatedat', { ascending: false });
    if (error) throw error;
    
    const enriched = await enrichConversations(data || [], userId);
    res.json(enriched);
  } catch (err) { 
    console.error('Conversations Fetch Error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations', details: err instanceof Error ? err.message : String(err) }); 
  }
});

app.get('/api/conversations/with/:targetUserId', async (req, res) => {
  const userId = getUserId(req);
  const { targetUserId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabase.from('conversations')
      .select('*')
      .eq('is_group', false)
      .contains('participants', [userId, targetUserId])
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Conversation not found' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { error } = await supabase.from('messages').delete().eq('conversationid', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to clear chat' }); }
});

app.post('/api/conversations', async (req, res) => {
  const userId = getUserId(req);
  const { targetUserId, participants, name } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const finalParticipants = participants || [userId, targetUserId];
    const isGroup = !!participants;
    const { data, error } = await supabase.from('conversations').insert({
      participants: finalParticipants, is_group: isGroup, name: name || null
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to create conversation' }); }
});

app.get('/api/conversations/:id/participants', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: convo } = await supabase.from('conversations').select('participants').eq('id', id).single();
    if (!convo) return res.status(404).json({ error: 'Not found' });
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', convo.participants);
    res.json(profiles || []);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/conversations/:id/action', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  const { action, newParticipants, avatarUrl } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: convo } = await supabase.from('conversations').select('participants').eq('id', id).single();
    if (!convo) return res.status(404).json({ error: 'Not found' });

    let updatedParticipants = [...(convo.participants || [])];

    if (action === 'add-members' && newParticipants) {
      updatedParticipants = Array.from(new Set([...updatedParticipants, ...newParticipants]));
    } else if (action === 'exit') {
      updatedParticipants = updatedParticipants.filter(p => p !== userId);
    } else if (action === 'update-avatar' && avatarUrl) {
      await supabase.from('conversations').update({ avatar_url: avatarUrl }).eq('id', id);
      return res.json({ success: true });
    }

    const { error } = await supabase.from('conversations').update({ participants: updatedParticipants }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Action failed' }); }
});

app.post('/api/conversations/:id/read', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await supabase.from('messages').update({ isread: true }).eq('conversationid', id).neq('senderid', userId).eq('isread', false);
    
    // Broadcast to the user's personal room so their UI refreshes
    io.to(userId).emit('messages_read', { conversationId: id });
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/blocks', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId);
    if (error) throw error;
    res.json((data || []).map(b => b.blocked_id));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/notifications', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/profile/:targetUserId', async (req, res) => {
  const { targetUserId } = req.params;
  const currentUserId = req.headers['x-user-id'] as string;

  try {
    const [profileRes, postsRes, repostsRes, repliesRes, likesRes, followersRes, followingRes, interactionsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetUserId).maybeSingle(),
      supabase.from('posts').select(POST_SELECT).eq('author_id', targetUserId).order('created_at', { ascending: false }),
      supabase.from('post_reposts').select('posts(' + POST_SELECT + ')').eq('user_id', targetUserId),
      supabase.from('post_comments').select('posts(' + POST_SELECT + ')').eq('user_id', targetUserId),
      supabase.from('post_likes').select('posts(' + POST_SELECT + ')').eq('user_id', targetUserId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_user_id', targetUserId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUserId),
      currentUserId ? Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', currentUserId),
        supabase.from('post_reposts').select('post_id').eq('user_id', currentUserId)
      ]) : Promise.resolve([{ data: [] }, { data: [] }])
    ]);

    const interactionData: any = interactionsRes;
    res.json({
      profile: profileRes.data,
      posts: postsRes.data || [],
      reposts: (repostsRes.data || []).map((r: any) => r.posts).filter(Boolean),
      replies: (repliesRes.data || []).map((r: any) => r.posts).filter(Boolean),
      likes: (likesRes.data || []).map((l: any) => l.posts).filter(Boolean),
      followerCount: followersRes.count || 0,
      followingCount: followingRes.count || 0,
      interactionStatus: {
        likedIds: interactionData[0]?.data?.map((i: any) => i.post_id) || [],
        repostedIds: interactionData[1]?.data?.map((i: any) => i.post_id) || []
      }
    });
  } catch (err) {
    console.error('Profile fetch failed:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/messages/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  try {
    const { data, error } = await supabase.from('messages').select('*, author:profiles!senderid(*)').eq('conversationid', conversationId).order('timestamp', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/search/users', async (req, res) => {
  const { q } = req.query;
  try {
    const { data, error } = await supabase.from('profiles').select('*').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).limit(10);
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

app.get('/api/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  try {
    const { data, error } = await supabase.from('post_comments').select('*, author:profiles!user_id(*)').eq('post_id', postId).order('created_at', { ascending: true });
    if (error) throw error;
    res.json((data || []).map(c => ({ id: c.id, content: c.content, created_at: c.created_at, author: { id: c.user_id, name: c.author?.full_name, handle: c.author?.username, avatar: c.author?.avatar_url } })));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/queue-activity', async (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || req.body.userId;
  const { type, payload } = req.body;
  if (!userId || !type) return res.status(400).json({ error: 'Missing data' });
  try {
    if (type === 'MESSAGE' || type === 'FOLLOW' || type === 'MESSAGE_UPDATE') { 
      await processEventBulk(userId, type, payload); 
      return res.json({ success: true, instant: true }); 
    }
    
    // REAL-TIME BROADCAST (Cheap Socket operation)
    if (type === 'BATCH') {
      (payload.events || []).forEach((e: any) => io.emit('activity_update', { userId, type: e.type, payload: e.payload }));
    } else {
      io.emit('activity_update', { userId, type, payload });
    }

    if (isKafkaAvailable()) {
      if (type === 'BATCH') {
        for (const e of (payload.events || [])) { await emitActivity(userId, e.type, e.payload); }
      } else {
        await emitActivity(userId, type, payload);
      }
      return res.json({ success: true, buffered: true, method: 'kafka' });
    } else {
      // REDIS FALLBACK (The primary Free-Tier Buffer)
      if (type === 'BATCH') {
        const events = (payload.events || []).map((e: any) => JSON.stringify({ ...e, ts: Date.now(), userId }));
        if (events.length > 0) await redis.lpush(REDIS_KEYS.PENDING_ACTIONS, ...events);
      } else {
        await redis.lpush(REDIS_KEYS.PENDING_ACTIONS, JSON.stringify({ userId, type, payload, ts: Date.now() }));
      }
      return res.json({ success: true, buffered: true, method: 'redis_fallback' });
    }
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/trending', async (req, res) => {
  try {
    const [hubs, users] = await Promise.all([
      redis.get('community:trending:hubs'),
      redis.get('community:trending:users')
    ]);
    res.json({ hubs: hubs || [], users: users || [] });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/worker/heartbeat', async (req, res) => {
  try {
    const signature = req.headers['upstash-signature'] as string;
    const isValid = await qstashReceiver.verify({ signature, body: JSON.stringify(req.body) });
    if (!isValid) return res.status(401).json({ error: 'Unauthorized' });
  } catch (err) { return res.status(401).json({ error: 'Verification failed' }); }

  const processingKey = `community:processing:${Date.now()}`;
  try {
    // 1. Process Redis Queue
    if (await redis.exists(REDIS_KEYS.PENDING_ACTIONS)) {
      await redis.rename(REDIS_KEYS.PENDING_ACTIONS, processingKey);
      const actions = await redis.lrange(processingKey, 0, -1);
      for (const actionStr of actions) { 
        const action = typeof actionStr === 'string' ? JSON.parse(actionStr) : actionStr; 
        await processEventBulk(action.userId, action.type, action.payload); 
      }
      await redis.del(processingKey);
    }

    // 2. Process Kafka (If available/enabled)
    if (isKafkaAvailable()) {
      const consumer = await getConsumer('heartbeat-worker');
      if (consumer) {
        await consumer.subscribe({ topic: TOPICS.ACTIVITIES, fromBeginning: true });
        await consumer.run({
          eachMessage: async ({ message }) => {
            if (message.value) {
              const { userId, type, payload } = JSON.parse(message.value.toString());
              await processEventBulk(userId, type, payload);
            }
          },
        });
        await new Promise(r => setTimeout(r, 2000));
        await consumer.stop();
      }
    }
    
    // 3. Trending & Cache Refresh
    const { data: trendingPosts } = await supabase.from("posts").select(POST_SELECT).order("likes_count", { ascending: false }).limit(5);
    if (trendingPosts) {
      const hubs = trendingPosts.map(p => ({ name: p.content.split(' ').slice(0, 2).join(' ') || 'Global Hub', posts: `${(p.likes_count || 0) + (p.comments_count || 0)}`, color: 'text-brand', bg: 'bg-brand/10' }));
      await redis.set('community:trending:hubs', hubs, { ex: 600 });
    }

    const { data: topUsers } = await supabase.from("profiles").select('*').limit(5);
    if (topUsers) {
      const users = topUsers.map(u => ({ id: u.id, name: u.full_name || u.username, handle: u.username, avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}` }));
      await redis.set('community:trending:users', users, { ex: 600 });
    }

    const { data: posts } = await supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(50);
    if (posts) await redis.set(REDIS_KEYS.FEED_CACHE, posts, { ex: 300 });

    res.json({ success: true });
  } catch (err) { 
    console.error('Heartbeat failed:', err);
    res.status(500).json({ error: 'Flush failed' }); 
  }
});

app.all('/api/*', (req, res) => { res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` }); });

io.on('connection', (socket) => { 
  socket.on('authenticate', (uId) => { socket.join(uId); }); 
});

// Support for SPA Routing - Optimized for Render
const frontendPath = path.resolve(__dirname, '../../Frontend/dist');
if (fs.existsSync(frontendPath)) {
  console.log(`✅ Serving Frontend from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  
  // Important: Do NOT serve index.html for missing assets
  app.get(['/assets/*', '/static/*'], (req, res) => {
    res.status(404).send('Asset not found');
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.warn(`⚠️ Warning: Frontend dist folder not found at ${frontendPath}`);
}

httpServer.listen(PORT, () => {
  console.log(`🚀 Shield Active on port ${PORT}`);
});