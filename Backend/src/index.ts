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

app.post('/api/conversations', async (req, res) => {
  const currentUserId = getUserId(req);
  const { targetUserId } = req.body;

  if (!currentUserId || !targetUserId) return res.status(400).json({ error: 'Missing IDs' });

  try {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .contains('participants', [currentUserId])
      .contains('participants', [targetUserId])
      .maybeSingle();

    if (existing) {
      return res.json({
        ...existing, 
        unreadCount: 0,
        updatedAt: existing.updatedat,
        lastMessage: existing.lastmessage
      });
    }

    const { data: newConvo, error } = await supabase
      .from('conversations')
      .insert({
        participants: [currentUserId, targetUserId],
        updatedat: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json({
      ...newConvo, 
      unreadCount: 0,
      updatedAt: newConvo.updatedat,
      lastMessage: newConvo.lastmessage
    });
  } catch (err) {
    console.error('Error starting conversation:', err);
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