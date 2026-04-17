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
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ===== MIDDLEWARE =====
const getUserId = (req: express.Request) => req.headers['x-user-id'] as string;

// ===== NOTIFICATIONS API =====
app.get('/api/notifications', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed' });
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
      .contains('participants', [userId])
      .order('updatedat', { ascending: false });

    if (error) throw error;

    const enrichedConvos = await Promise.all((convos || []).map(async (convo) => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversationid', convo.id)
        .eq('isread', false)
        .neq('senderid', userId);

      return {
        ...convo,
        unreadCount: count || 0,
        updatedAt: convo.updatedat,
        lastMessage: convo.lastmessage
      };
    }));

    res.json(enrichedConvos);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
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
  } catch (err) {
    console.error('Error finding conversation:', err);
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
      const { data: existing, error: findError } = await supabase
        .from('conversations')
        .select('*')
        .eq('is_group', false)
        .contains('participants', [currentUserId])
        .contains('participants', [targetUserId])
        .maybeSingle();

      if (findError) console.error('Database find error:', findError);

      if (existing) {
        return res.json({
          ...existing, 
          unreadCount: 0,
          updatedAt: existing.updatedat,
          lastMessage: existing.lastmessage
        });
      }

      const { data: newConvo, error: insError } = await supabase
        .from('conversations')
        .insert({
          participants: [currentUserId, targetUserId],
          updatedat: new Date().toISOString(),
          is_group: false
        })
        .select()
        .single();

      if (insError) {
        console.error('DATABASE INSERT ERROR (DM):', insError);
        throw insError;
      }

      return res.json({
        ...newConvo, 
        unreadCount: 0,
        updatedAt: newConvo.updatedat,
        lastMessage: newConvo.lastmessage
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
          admins: [currentUserId],
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

    const participantsWithAdmin = (profiles || []).map(p => ({
      ...p,
      isAdmin: Array.isArray(convo.admins) ? convo.admins.includes(p.id) : (participantIds[0] === p.id) 
    }));

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
    const isAdmin = Array.isArray(convo.admins) ? convo.admins.includes(currentUserId) : (participantIds[0] === currentUserId);
    
    let updatedParticipants = [...participantIds];
    let updatedAdmins = Array.isArray(convo.admins) ? [...convo.admins] : (participantIds[0] ? [participantIds[0]] : []);

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

    // Build update object dynamically to avoid errors if columns are missing
    const updateData: any = { participants: updatedParticipants };
    if (convo.hasOwnProperty('admins')) {
      updateData.admins = updatedAdmins;
    }

    const { error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({ success: true });
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
      .select(MESSAGE_QUERY)
      .eq('conversationid', conversationId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const mappedMessages = (messages || []).map(m => ({
      ...m,
      senderId: m.senderid
    }));

    if (userId) {
      await supabase
        .from('messages')
        .update({ isread: true })
        .eq('conversationid', conversationId)
        .neq('senderid', userId)
        .eq('isread', false);
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
  socket.on('authenticate', (userId: string) => {
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

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT} with Supabase DB`);
});