import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { supabase } from './supabase';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Allow both but prefer websocket if client asks
  pingTimeout: 60000, // Increase for free tier stability
  pingInterval: 25000
});

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ===== MIDDLEWARE =====
const getUserId = (req: express.Request) => req.headers['x-user-id'] as string;

// Simple In-Memory Cache (30-second TTL)
const bootstrapCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

// ===== BOOTSTRAP API (The "Ultimate Reduction" Fix) =====
app.get('/api/bootstrap', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // 1. Check Cache first
  const cached = bootstrapCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    // Parallelize all heavy lifting
    const [profileRes, convRes, notifRes, postsRes, followRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('conversations').select('*').contains('participants', [userId]).limit(10),
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('posts').select(`
        *,
        author:profiles(*),
        likesCount:post_likes(count),
        repostsCount:post_reposts(count),
        commentsCount:post_comments(count)
      `).order('created_at', { ascending: false }).limit(20),
      supabase.from('follows').select('following_user_id').eq('follower_id', userId)
    ]);

    // 1. Enrich Conversations
    const conversations = await Promise.all((convRes.data || []).map(async (convo: any) => {
      const [countRes, otherProfile] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversationid', convo.id).eq('isread', false).neq('senderid', userId),
        !convo.is_group ? supabase.from('profiles').select('*').eq('id', convo.participants.find((p: string) => p !== userId)).maybeSingle() : Promise.resolve({ data: null })
      ]);
      return {
        ...convo,
        unreadCount: countRes.count || 0,
        profile: otherProfile.data,
        updatedAt: convo.updatedat || convo.updated_at,
        lastMessage: convo.lastmessage || convo.last_message
      };
    }));

    // 2. Enrich Posts (Merge counts into flattened numbers)
    const postIds = (postsRes.data || []).map((p: any) => p.id);
    const [likesRes, repostsRes] = await Promise.all([
      userId ? supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', userId) : Promise.resolve({ data: [] }),
      userId ? supabase.from('post_reposts').select('post_id').in('post_id', postIds).eq('user_id', userId) : Promise.resolve({ data: [] })
    ]);

    const likedIds = new Set(likesRes.data?.map((l: any) => l.post_id));
    const repostedIds = new Set(repostsRes.data?.map((r: any) => r.post_id));

    const posts = (postsRes.data || []).map((post: any) => ({
      ...post,
      likesCount: post.likesCount?.[0]?.count || 0,
      repostsCount: post.repostsCount?.[0]?.count || 0,
      commentsCount: post.commentsCount?.[0]?.count || 0,
      isLiked: likedIds.has(post.id),
      isReposted: repostedIds.has(post.id),
      timestamp: post.created_at
    }));

    const finalData = {
      profile: profileRes.data,
      conversations,
      notifications: notifRes.data || [],
      posts,
      following: (followRes.data || []).map((f: any) => f.following_user_id)
    };

    // 2. Store in Cache
    bootstrapCache.set(userId, { data: finalData, timestamp: Date.now() });

    res.json(finalData);
  } catch (err) {
    console.error('Bootstrap Critical Failure:', err);
    res.status(500).json({ error: 'Bootstrap failed' });
  }
});

// ===== NOTIFICATIONS API =====
app.get('/api/notifications', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .limit(50);

    // If 'message' doesn't exist, we fallback to an empty result rather than erroring out
    if (error) {
      console.warn('Notifications fetch warning:', error.message);
      return res.json([]);
    }
    res.json(data || []);
  } catch (err) {
    res.json([]);
  }
});

// ===== CONVERSATIONS API =====

app.get('/api/conversations', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: convos, error } = await supabase
      .from('conversations')
      .select('*')
      .contains('participants', [userId]);

    if (error) {
      console.warn('Conversations fetch warning:', error.message);
      return res.json([]);
    }

    const enrichedConvos = await Promise.all((convos || []).map(async (convo) => {
      try {
        const [countResult, profileResult] = await Promise.all([
          supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversationid', convo.id)
            .eq('isread', false)
            .neq('senderid', userId),

          !convo.is_group ? supabase
            .from('profiles')
            .select('*')
            .eq('id', convo.participants?.find((p: string) => p !== userId) || '')
            .single() : Promise.resolve({ data: null })
        ]);

        return {
          ...convo,
          unreadCount: countResult.count || 0,
          profile: profileResult.data,
          updatedAt: convo.updatedat || convo.updated_at,
          lastMessage: convo.lastmessage || convo.last_message
        };
      } catch (e) {
        return { ...convo, unreadCount: 0, profile: null };
      }
    }));

    res.json(enrichedConvos);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/conversations/with/:targetUserId', async (req, res) => {
  const currentUserId = getUserId(req);
  const { targetUserId } = req.params;

  if (!currentUserId || !targetUserId) return res.status(400).json({ error: 'Missing IDs' });

  try {
    const { data: existing, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('is_group', false)
      .contains('participants', [currentUserId])
      .contains('participants', [targetUserId])
      .maybeSingle();

    if (error) throw error;
    if (!existing) return res.status(404).json({ error: 'Not found' });

    res.json({
      ...existing,
      updatedAt: existing.updatedat,
      lastMessage: existing.lastmessage
    });
  } catch (err: any) {
    console.error('Error finding conversation:', err.message || err, err);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/conversations', async (req, res) => {
  const currentUserId = getUserId(req);
  const { targetUserId, participants, name } = req.body;

  if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1. If it's a single DM
    if (targetUserId && !participants) {
      // Find existing
      const { data: existing, error: findError } = await supabase
        .from('conversations')
        .select('*')
        .eq('is_group', false)
        .contains('participants', [currentUserId])
        .contains('participants', [targetUserId])
        .maybeSingle();

      if (existing) {
        return res.json({
          ...existing,
          unreadCount: 0,
          updatedAt: existing.updatedat || existing.updated_at,
          lastMessage: existing.lastmessage || existing.last_message
        });
      }

      const insertData: any = {
        participants: [currentUserId, targetUserId],
        is_group: false
      };

      // Handle naming variants for timestamps
      const timestamp = new Date().toISOString();
      insertData.updatedat = timestamp; 
      // Try updated_at too just in case
      insertData.updated_at = timestamp;

      const { data: newConvo, error: insError } = await supabase
        .from('conversations')
        .insert(insertData)
        .select()
        .single();

      if (insError) {
        console.error('DATABASE INSERT ERROR (DM):', insError.message, insError.code, insError.details);
        // Better error response for the UI to show
        return res.status(500).json({ 
          error: 'Security Policy Violation', 
          details: insError.message || 'Please ensure you have run the latest SQL migration in Supabase to allow chat creation.',
          code: insError.code 
        });
      }

      return res.json({
        ...newConvo,
        unreadCount: 0,
        updatedAt: newConvo.updatedat,
        lastMessage: 'New Chat'
      });
    }

    // 2. If it's a Group creation
    if (participants && Array.isArray(participants)) {
      const allParticipants = Array.from(new Set([currentUserId, ...participants]));

      const { data: newGroup, error: groupError } = await supabase
        .from('conversations')
        .insert({
          participants: allParticipants,
          name: name || 'New Group',
          is_group: true,
          updatedat: new Date().toISOString()
        })
        .select()
        .single();

      if (groupError) {
        console.error('DATABASE INSERT ERROR (GROUP):', groupError);
        throw groupError;
      }

      return res.json({
        ...newGroup,
        unreadCount: 0,
        updatedAt: newGroup.updatedat,
        lastMessage: 'Group created'
      });
    }

    return res.status(400).json({ error: 'Missing targetUserId or participants array' });
  } catch (err: any) {
    console.error('CRITICAL BACKEND ERROR:', err.message || err);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/conversations/:id/participants', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (convoError) throw convoError;
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const participantIds = Array.isArray(convo.participants) ? convo.participants : [];
    if (participantIds.length === 0) return res.json([]);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', participantIds);

    if (profilesError) throw profilesError;

    const adminIds = Array.isArray(convo.admins) ? convo.admins : (Array.isArray(convo.admin_ids) ? convo.admin_ids : []);
    
    const participantsWithAdmin = (profiles || []).map(p => {
      let isAdmin = adminIds.includes(p.id);
      // Fallback: If no admins are set yet, the first participant is the de-facto admin
      if (adminIds.length === 0 && participantIds[0] === p.id) isAdmin = true;
      
      return { ...p, isAdmin };
    });

    res.json(participantsWithAdmin);
  } catch (err: any) {
    console.error('Error fetching participants:', err.message || err);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/conversations/:id/action', async (req, res) => {
  const { id } = req.params;
  const { action, targetUserId } = req.body;
  const currentUserId = getUserId(req);
  if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (convoError) throw convoError;
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const participantIds = Array.isArray(convo.participants) ? convo.participants : [];
    const adminIds = Array.isArray(convo.admins) ? convo.admins : (Array.isArray(convo.admin_ids) ? convo.admin_ids : []);
    
    const isAdmin = adminIds.includes(currentUserId) || (adminIds.length === 0 && participantIds[0] === currentUserId);

    let updatedParticipants = [...participantIds];
    let updatedAdmins = [...adminIds];

    if (action === 'update-avatar') {
      if (!isAdmin) return res.status(403).json({ error: 'Only admins can update group avatar' });
      const { avatarUrl } = req.body;
      if (!avatarUrl) return res.status(400).json({ error: 'Missing avatarUrl' });

      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          avatar_url: avatarUrl,
          updatedat: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;
      return res.json({ success: true, avatarUrl });
    }

    if (action === 'exit') {
      updatedParticipants = updatedParticipants.filter(p => p !== currentUserId);
      updatedAdmins = updatedAdmins.filter(a => a !== currentUserId);
    } else if (action === 'make-admin') {
      if (!isAdmin) return res.status(403).json({ error: 'Only admins can make other members admins' });
      if (!updatedAdmins.includes(targetUserId)) {
        updatedAdmins.push(targetUserId);
      }
    } else if (action === 'remove') {
      if (!isAdmin) return res.status(403).json({ error: 'Only admins can remove members' });
      updatedParticipants = updatedParticipants.filter(p => p !== targetUserId);
      updatedAdmins = updatedAdmins.filter(a => a !== targetUserId);
    } else if (action === 'add-members') {
      if (!isAdmin) return res.status(403).json({ error: 'Only admins can add members' });
      const { newParticipants } = req.body;
      if (Array.isArray(newParticipants)) {
        updatedParticipants = Array.from(new Set([...updatedParticipants, ...newParticipants]));
      }
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Build update object dynamically to handle different DB naming styles
    const updateData: any = { 
      participants: updatedParticipants,
      updatedat: new Date().toISOString()
    };
    
    // Support multiple naming conventions for the admins column
    if (convo.hasOwnProperty('admins')) updateData.admins = updatedAdmins;
    if (convo.hasOwnProperty('admin_ids')) updateData.admin_ids = updatedAdmins;

    const { error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    // Notify others via socket
    io.to(id).emit('group_update', { id, action, targetUserId });

    res.json({ success: true, action, targetUserId });
  } catch (err: any) {
    console.error('Error performing group action:', err.message || err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ===== MESSAGES API =====

const MESSAGE_QUERY = `
  *,
  reply_to:messages!reply_to_id (
    text,
    senderid,
    image_url,
    voice_url,
    author:profiles!senderid (full_name)
  )
`;

app.get('/api/messages/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const userId = getUserId(req);

  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*, reply_to:messages!reply_to_id(*)')
      .eq('conversationid', conversationId)
      .order('timestamp', { ascending: false })
      .range(0, 49); // Keep pagination to save IO

    if (error) throw error;

    // Newest are first due to order DESC, reverse for UI chronological order
    const mappedMessages = (messages || []).reverse().map(m => ({
      ...m,
      senderId: m.senderid
    }));

    if (userId) {
      // Perform read status update in background or only if unread exists
      supabase
        .from('messages')
        .update({ isread: true })
        .eq('conversationid', conversationId)
        .neq('senderid', userId)
        .eq('isread', false)
        .then(({ error: readError }) => {
          if (readError) console.error('Error marking as read:', readError);
        });
    }

    res.json(mappedMessages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/messages', async (req, res) => {
  const currentUserId = getUserId(req);
  const { conversationId, text, imageUrl, voiceUrl, replyToId } = req.body;

  if (!currentUserId || !conversationId) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversationid: conversationId,
        senderid: currentUserId,
        text,
        image_url: imageUrl,
        voice_url: voiceUrl,
        reply_to_id: replyToId,
        timestamp: new Date().toISOString()
      })
      .select(MESSAGE_QUERY)
      .single();

    if (msgError) throw msgError;

    // Map to frontend format
    const formattedMsg = {
      ...newMessage,
      senderId: newMessage.senderid
    };

    await supabase
      .from('conversations')
      .update({
        lastmessage: text || (imageUrl ? '📷 Photo' : voiceUrl ? '🎤 Voice message' : ''),
        updatedat: newMessage.timestamp
      })
      .eq('id', conversationId);

    const result = {
      ...newMessage,
      senderId: newMessage.senderid
    };

    io.to(conversationId).emit('new_message', result);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ===== SOCKET.IO LOGIC =====
const onlineUsers = new Map<string, string>();

io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  socket.on('authenticate', (userId: string) => {
    if (!userId) return;
    console.log(`👤 User authenticated: ${userId} (Socket: ${socket.id})`);
    onlineUsers.set(userId, socket.id);
    io.emit('user_status_change', { userId, status: 'online' });
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('typing', ({ roomId, userId }) => {
    socket.to(roomId).emit('user_typing', { userId });
  });

  socket.on('disconnect', () => {
    for (const [uId, sId] of onlineUsers.entries()) {
      if (sId === socket.id) {
        onlineUsers.delete(uId);
        io.emit('user_status_change', { userId: uId, status: 'offline' });
        break;
      }
    }
  });
});

// ===== STATIC ASSETS & SPA ROUTING =====
const rootDir = path.join(__dirname, '..', '..');
const frontendDistPath = path.join(rootDir, "Frontend", "dist");

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ message: "Community API Connected" });
  });
}

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`✅ Supabase DB connection initialized`);
});