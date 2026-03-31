import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 10000;
const USERS_FILE = path.join(__dirname, 'users.json');
const CONVERSATIONS_FILE = path.join(__dirname, 'conversations.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

app.use(cors());
app.use(express.json());

// ===== DATABASE HELPERS =====
const loadFile = <T>(filePath: string, defaultVal: T): T => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error loading ${filePath}:`, err);
  }
  return defaultVal;
};

const saveFile = (filePath: string, data: any) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
  }
};

let usersData = loadFile<Record<string, User>>(USERS_FILE, {});
let conversations = loadFile<Conversation[]>(CONVERSATIONS_FILE, []);
let messagesStore = loadFile<Message[]>(MESSAGES_FILE, []);

// ===== INTERFACES =====
interface User {
  id: string;
  username: string;
  followers: string[];
  following: string[];
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: string;
  seen: boolean;
}

// ===== AUTH MIDDLEWARE (MOCK) =====
const getUserId = (req: express.Request) => req.headers['x-user-id'] as string;

// ===== MESSAGING API =====

// 2. Start Conversation: POST /api/conversations
app.post('/api/conversations', (req, res) => {
  const currentUserId = getUserId(req);
  const { targetUserId } = req.body;

  if (!currentUserId || !targetUserId) return res.status(400).json({ error: 'Missing user IDs' });

  // Check if exists
  let conversation = conversations.find(c => 
    c.participants.includes(currentUserId) && c.participants.includes(targetUserId)
  );

  if (!conversation) {
    conversation = {
      id: uuidv4(),
      participants: [currentUserId, targetUserId],
      updatedAt: new Date().toISOString()
    };
    conversations.push(conversation);
    saveFile(CONVERSATIONS_FILE, conversations);
  }

  res.json(conversation);
});

// GET Conversations List
app.get('/api/conversations', (req, res) => {
  const currentUserId = getUserId(req);
  if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });

  const userConvos = conversations.filter(c => c.participants.includes(currentUserId));
  res.json(userConvos);
});

// 4. Get Messages: GET /api/messages/:conversationId
app.get('/api/messages/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const filteredMessages = messagesStore.filter(m => m.conversationId === conversationId);
  res.json(filteredMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
});

// 3. Send Message: POST /api/messages
app.post('/api/messages', (req, res) => {
  const currentUserId = getUserId(req);
  const { conversationId, text } = req.body;

  if (!currentUserId || !conversationId || !text) return res.status(400).json({ error: 'Missing fields' });

  const newMessage: Message = {
    id: uuidv4(),
    conversationId,
    senderId: currentUserId,
    text,
    timestamp: new Date().toISOString(),
    seen: false
  };

  messagesStore.push(newMessage);
  saveFile(MESSAGES_FILE, messagesStore);

  // Update conversation last message
  const convo = conversations.find(c => c.id === conversationId);
  if (convo) {
    convo.lastMessage = text;
    convo.updatedAt = new Date().toISOString();
    saveFile(CONVERSATIONS_FILE, conversations);
  }

  // Emit to listeners in this conversation
  io.to(conversationId).emit('new_message', newMessage);

  res.status(201).json(newMessage);
});

// ===== SOCKET.IO REAL-TIME =====
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on('typing', ({ roomId, userId }) => {
    socket.to(roomId).emit('user_typing', { userId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// ===== SERVE FRONTEND (PORT UPDATED) =====
const rootDir = path.resolve();
app.use(express.static(path.join(rootDir, "Frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "Frontend/dist/index.html"));
});


httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});