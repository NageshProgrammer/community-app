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

// ===== RATE LIMITER (protects DB at 10K user scale) =====
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // max requests per window per user
const RATE_WINDOW = 60 * 1000; // 60 second window

const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = (req.headers['x-user-id'] as string) || req.ip || 'anon';
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return next();
  }
  if (record.count >= RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  record.count++;
  next();
};

// Clean up rate limit map every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((v, k) => { if (now > v.resetAt) rateLimitMap.delete(k); });
}, 5 * 60 * 1000);

app.use('/api', rateLimiter);
// Disable caching for all API routes so the frontend always gets fresh data
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

const getUserId = (req: express.Request) => req.headers['x-user-id'] as string;

// ===== CONSTANTS =====
const POST_SELECT = '*, author:profiles!author_id(*), likes_count, comments_count, reposts_count';

// ===== HELPERS =====


async function refreshFeedCache() {
  const { data: freshPosts } = await supabase.from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);
  if (freshPosts) {
    await redis.set(REDIS_KEYS.FEED_CACHE, freshPosts, { ex: 300 });
  }
}

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
        // Invalidate per-user interaction cache so next feed load reflects the change
        await redis.del(REDIS_KEYS.userInteractions(userId));
        await refreshFeedCache();
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
        // Invalidate per-user interaction cache
        await redis.del(REDIS_KEYS.userInteractions(userId));
        await refreshFeedCache();
        break;
      }
      case 'COMMENT': {
        const { postId, content } = payload;
        const { data: newComment, error } = await supabase.from('post_comments')
          .insert({ post_id: postId, user_id: userId, content })
          .select('*, author:profiles!user_id(*)')
          .single();
          
        if (error) {
          console.error('❌ Supabase Comment Error:', error);
          throw new Error(`COMMENT_FAILED: ${error.message}`);
        }
        await supabase.rpc('increment_comments', { p_id: postId });
        await refreshFeedCache();
        
        if (newComment) {
           io.emit('new_comment', {
             id: newComment.id,
             post_id: postId,
             content: newComment.content,
             created_at: newComment.created_at,
             author: {
               id: newComment.user_id,
               name: newComment.author?.full_name,
               handle: newComment.author?.username,
               avatar: newComment.author?.avatar_url
             }
           });
        }
        break;
      }
      case 'POST': {
        const { content, image, location } = payload;
        const postData = {
          author_id: userId, 
          content: content, 
          image: image, 
          location: location,
          title: content ? content.substring(0, 30) : 'Community Post'
        };
        
        console.log('🚀 [POST] Attempting DB Insert:', postData);

        const { data: post, error } = await supabase.from('posts')
          .insert(postData)
          .select(POST_SELECT)
          .single();
        
        if (error) {
          console.error('❌ [POST] DB Insert Failed!');
          console.error('Error Code:', error.code);
          console.error('Error Message:', error.message);
          console.error('Error Details:', error.details);
          throw new Error(`POST_FAILED: ${error.message}`);
        }

        if (post) {
          console.log('✅ [POST] Saved to DB:', post.id);
          io.emit('new_post', post);
          await refreshFeedCache();
        }
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
        // Invalidate following cache for this user
        await redis.del(REDIS_KEYS.userFollowing(userId));
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

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    const redisStatus = await redis.ping();
    res.json({ 
      status: 'ok', 
      database: error ? 'error' : 'connected', 
      redis: redisStatus === 'PONG' ? 'connected' : 'error',
      dbError: error
    });
  } catch (err) {
    res.status(500).json({ status: 'error', details: err instanceof Error ? err.message : String(err) });
  }
});

// ===== API ROUTES =====

app.get('/api/bootstrap', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    // Check Redis cache first — serve from cache for 60s to protect DB at scale
    const cacheKey = REDIS_KEYS.userBootstrap(userId);
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`⚡ [Bootstrap] Cache HIT for user ${userId.substring(0,8)}`);
      return res.json(cached);
    }

    console.log(`🔄 [Bootstrap] Cache MISS — querying DB for user ${userId.substring(0,8)}`);
    const [profileRes, convRes, notifRes, postsRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('conversations').select('*').contains('participants', [userId]).order('updatedat', { ascending: false }).limit(20),
      supabase.from('notifications').select('*, sender:profiles!senderid(full_name, username, avatar_url)').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      redis.get(REDIS_KEYS.FEED_CACHE), // Use feed cache — never query posts fresh on bootstrap
      supabase.from('follows').select('following_user_id').eq('follower_id', userId)
    ]);

    let profileData = profileRes.data;
    if (!profileData) {
      const { data: newData } = await supabase.from('profiles').upsert({
        id: userId,
        username: 'user_' + userId.substring(0, 5),
        full_name: 'New Member',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
      }).select().single();
      profileData = newData;
    }

    // Get or fetch posts
    let posts = postsRes as any[];
    if (!posts) {
      const { data } = await supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(20);
      posts = data || [];
      await redis.set(REDIS_KEYS.FEED_CACHE, posts, { ex: 300 });
    }

    const enrichedConvos = await enrichConversations(convRes.data || [], userId);
    const following = (followRes.data || []).map((f: any) => f.following_user_id);

    const payload = { 
      profile: profileData, 
      notifications: notifRes.data || [], 
      posts: posts.slice(0, 20), 
      following,
      conversations: enrichedConvos,
      serverTime: new Date().toISOString(),
      _cached: false
    };

    // Cache per-user for 60 seconds — huge win at scale
    await redis.set(cacheKey, { ...payload, _cached: true }, { ex: 60 });
    // Also cache following separately for other routes
    await redis.set(REDIS_KEYS.userFollowing(userId), following, { ex: 120 });

    res.json(payload);
  } catch (err) { 
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Bootstrap failed' }); 
  }
});

async function enrichConversations(convos: any[], userId: string) {
  if (!userId || convos.length === 0) return convos;

  try {
    // 1. Batch fetch unread counts to avoid "spamming" HEAD requests
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const convoIds = convos.map(c => c.id).filter(id => id && uuidRegex.test(id));
    if (convoIds.length === 0) return convos;

    const { data: unreadData, error: unreadError } = await supabase
      .from('messages')
      .select('conversationid, senderid')
      .in('conversationid', convoIds)
      .eq('isread', false);
      
    if (unreadError) {
      console.error('❌ [UnreadCount] Supabase Error:', unreadError);
      console.error('Convo IDs attempted:', convoIds);
    }

    // Filter unread data by senderid != userId in JS to be safe if the filter above is grumpy
    const validUnreadData = (unreadData || []).filter((msg: any) => msg.senderid !== userId);

    // Map counts to conversation IDs
    const unreadCountsMap = validUnreadData.reduce((acc: any, msg: any) => {
      acc[msg.conversationid] = (acc[msg.conversationid] || 0) + 1;
      return acc;
    }, {});

    // 2. Fetch all profiles in one go
    const otherIds = Array.from(new Set(
      convos.flatMap(c => (c.participants || []))
      .filter((p: string) => p && p.toLowerCase() !== userId.toLowerCase())
    ));

    let profilesMap: any = {};
    if (otherIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', otherIds);
      profilesMap = (profilesData || []).reduce((acc: any, p: any) => {
        acc[p.id] = {
          ...p,
          display_name: p.full_name || p.username || 'User',
          initial: (p.full_name || p.username || 'U').substring(0, 1).toUpperCase()
        };
        return acc;
      }, {});
    }

    return convos.map(convo => {
      const otherId = convo.participants?.find((p: string) => p.toLowerCase() !== userId.toLowerCase());
      return {
        ...convo,
        profile: otherId ? profilesMap[otherId] : null,
        unreadCount: unreadCountsMap[convo.id] || 0
      };
    });
  } catch (err) {
    console.error('Error enriching conversations:', err);
    return convos;
  }
}

app.get('/api/posts', async (req, res) => {
  try {
    const currentUserId = req.headers['x-user-id'] as string;
    const cachedFeed = await redis.get(REDIS_KEYS.FEED_CACHE);
    let posts = cachedFeed as any[];

    if (!posts) {
      const { data, error } = await supabase.from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      posts = data || [];
      await redis.set(REDIS_KEYS.FEED_CACHE, posts, { ex: 300 });
    }

    // Cache user interactions in Redis to avoid per-request DB queries
    let likedIds: string[] = [];
    let repostedIds: string[] = [];

    if (currentUserId) {
      const interactionKey = REDIS_KEYS.userInteractions(currentUserId);
      const cachedInteractions = await redis.get(interactionKey) as any;

      if (cachedInteractions) {
        likedIds = cachedInteractions.likedIds || [];
        repostedIds = cachedInteractions.repostedIds || [];
      } else {
        // Only query DB on cache miss
        const [likes, reposts] = await Promise.all([
          supabase.from('post_likes').select('post_id').eq('user_id', currentUserId),
          supabase.from('post_reposts').select('post_id').eq('user_id', currentUserId)
        ]);
        likedIds = likes.data?.map(l => l.post_id) || [];
        repostedIds = reposts.data?.map(r => r.post_id) || [];
        // Cache for 2 minutes — invalidated on like/repost actions
        await redis.set(interactionKey, { likedIds, repostedIds }, { ex: 120 });
      }
    }

    const enhancedPosts = posts.map(post => ({
      ...post,
      isLiked: likedIds.includes(post.id),
      isReposted: repostedIds.includes(post.id)
    }));

    res.json(enhancedPosts);
  } catch (err) { 
    console.error('Fetch posts error:', err);
    res.status(500).json({ error: 'Failed' }); 
  }
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

app.delete('/api/conversations/:id', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    // Note: In a production app, verify if the user is an admin. For demo, anyone can delete.
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete conversation' }); }
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
    let finalParticipants;
    if (participants) {
      // For groups, ensure the creator is the FIRST participant (the admin)
      finalParticipants = Array.from(new Set([userId, ...participants]));
    } else {
      finalParticipants = [userId, targetUserId];
    }
    
    const isGroup = !!participants;
    const { data, error } = await supabase.from('conversations').insert({
      participants: finalParticipants, is_group: isGroup, name: name || null
    }).select().single();
    if (error) throw error;

    // Notify all participants about the new conversation via Socket.io
    finalParticipants.forEach((pId: string) => {
      io.to(pId).emit('new_conversation', data);
    });

    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to create conversation' }); }
});

app.get('/api/conversations/:id/participants', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: convo } = await supabase.from('conversations').select('participants').eq('id', id).single();
    if (!convo) return res.status(404).json({ error: 'Not found' });
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', convo.participants);
    
    // Inject isAdmin flag
    const enriched = (profiles || []).map(p => ({
      ...p,
      // For demo: treat the first participant OR the specific user as Admin
      isAdmin: p.id === convo.participants[0] || p.id === '12765712-1042-41bb-93bf-864cee2db2be'
    }));
    
    res.json(enriched);
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

    const isAdmin = convo.participants[0] === userId || userId === '12765712-1042-41bb-93bf-864cee2db2be';

    if (action === 'add-members' && newParticipants) {
      updatedParticipants = Array.from(new Set([...updatedParticipants, ...newParticipants]));
    } else if (action === 'exit') {
      updatedParticipants = updatedParticipants.filter(p => p !== userId);
    } else if (action === 'remove' && req.body.targetUserId) {
      if (!isAdmin) return res.status(403).json({ error: 'Only admins can remove members' });
      updatedParticipants = updatedParticipants.filter(p => p !== req.body.targetUserId);
    } else if (action === 'make-admin' && req.body.targetUserId) {
      if (!isAdmin) return res.status(403).json({ error: 'Only admins can change admin' });
      // Move targetUserId to index 0
      updatedParticipants = [req.body.targetUserId, ...updatedParticipants.filter(p => p !== req.body.targetUserId)];
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
    const { data, error } = await supabase.from('notifications')
      .select('*, sender:profiles!senderid(full_name, username, avatar_url)')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Mark single notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Mark all notifications as read
app.patch('/api/notifications/read-all', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Delete notification
app.delete('/api/notifications/:id', async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Get full profiles of users following the given user
app.get('/api/profile/:userId/followers', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles!follower_id(*)')
      .eq('following_user_id', userId);
    
    if (error) throw error;
    res.json((data || []).map((d: any) => d.profiles).filter(Boolean));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Get full profiles of users the given user is following
app.get('/api/profile/:userId/following', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('profiles!following_user_id(*)')
      .eq('follower_id', userId);
    
    if (error) throw error;
    res.json((data || []).map((d: any) => d.profiles).filter(Boolean));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Get following IDs for a user (cached in Redis for 2 min)
app.get('/api/following/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const cacheKey = REDIS_KEYS.userFollowing(userId);
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(cached);

    const { data, error } = await supabase.from('follows').select('following_user_id').eq('follower_id', userId);
    if (error) throw error;
    const result = (data || []).map((f: any) => f.following_user_id);
    await redis.set(cacheKey, result, { ex: 120 });
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Check block status between two users
app.get('/api/blocks/check/:targetUserId', async (req, res) => {
  const userId = getUserId(req);
  const { targetUserId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data } = await supabase.from('blocks').select('id').eq('blocker_id', userId).eq('blocked_id', targetUserId).maybeSingle();
    res.json({ isBlocked: !!data });
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

    let profileData = profileRes.data;
    
    // Auto-create profile if it doesn't exist (e.g. first login)
    if (!profileData && targetUserId === currentUserId) {
       const { data: newData } = await supabase.from('profiles').upsert({
         id: targetUserId,
         username: 'user_' + targetUserId.substring(0,5),
         full_name: 'New Member',
         avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUserId}`
       }).select().single();
       profileData = newData;
    }

    const interactionData: any = interactionsRes;
    res.json({
      profile: profileData,
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

app.post('/api/profile/update', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { username, full_name, bio, website, avatar_url, cover_url } = req.body;
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username,
        full_name,
        bio,
        website,
        avatar_url,
        cover_url,
      })
      .select()
      .single();

    if (error) throw error;
    
    // Invalidate bootstrap cache as profile changed
    await redis.del(REDIS_KEYS.userBootstrap(userId));
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/profile/:id/followers', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('follower:profiles!follower_id(*)')
      .eq('following_user_id', id);
    if (error) throw error;
    res.json((data || []).map((f: any) => f.follower).filter(Boolean));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/profile/:id/following', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('following:profiles!following_user_id(*)')
      .eq('follower_id', id);
    if (error) throw error;
    res.json((data || []).map((f: any) => f.following).filter(Boolean));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
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
    const instantTypes = ['MESSAGE', 'FOLLOW', 'MESSAGE_UPDATE', 'POST', 'COMMENT', 'LIKE', 'REPOST'];
    if (instantTypes.includes(type)) { 
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