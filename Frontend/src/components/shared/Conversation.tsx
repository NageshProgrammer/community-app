import { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, MoreVertical, Image, Smile, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';

type Message = {
  id: string;
  text: string;
  senderId: string;
  timestamp: string;
};

type Chat = {
  id: string;
  sender: string;
  avatarColor: string;
  initials: string;
  isOnline: boolean;
};

interface ConversationProps {
  chat: Chat;
  onBack: () => void;
}

const socket = io('http://localhost:10000');

export default function Conversation({ chat, onBack }: ConversationProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch History
  useEffect(() => {
    if (!chat.id) return;

    const fetchMessages = async () => {
      try {
        const response = await fetch(`http://localhost:10000/api/messages/${chat.id}`);
        const data = await response.json();
        setMessages(data);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages();

    // Join Socket Room
    socket.emit('join_room', chat.id);

    const handleNewMessage = (msg: Message) => {
      if (msg.senderId !== user?.id) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('new_message', handleNewMessage);
    
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [chat.id, user?.id]);

  // 2. Scroll to Bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 3. Send Message
  const handleSend = async () => {
    if (!newMessage.trim() || !user || !chat.id) return;
    
    const text = newMessage;
    setNewMessage(''); // Clear input

    try {
      const response = await fetch('http://localhost:10000/api/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id 
        },
        body: JSON.stringify({
          conversationId: chat.id,
          text
        })
      });

      if (response.ok) {
        const sentMsg = await response.json();
        setMessages(prev => [...prev, sentMsg]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-[calc(100vh-140px)] bg-dark border border-gray-800 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${chat.avatarColor}`}>
              {chat.initials}
            </div>
            {chat.isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-dark rounded-full" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-white">{chat.sender}</h3>
            <p className="text-xs text-gray-500">{chat.isOnline ? 'Online' : 'Last seen 2h ago'}</p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <MoreVertical className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
              msg.senderId === user?.id 
                ? 'bg-brand text-white rounded-tr-none' 
                : 'bg-gray-800 text-gray-200 rounded-tl-none'
            }`}>
              <p className="text-sm">{msg.text}</p>
              <p className={`text-[10px] mt-1 ${msg.senderId === user?.id ? 'text-blue-100' : 'text-gray-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-2 bg-gray-800 rounded-2xl px-4 py-2">
          <button className="text-gray-500 hover:text-brand transition-colors">
            <Image className="w-5 h-5" />
          </button>
          <button className="text-gray-500 hover:text-brand transition-colors">
            <Smile className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-transparent border-none outline-none text-white text-sm py-2 placeholder-gray-500"
          />
          {newMessage ? (
            <button 
              onClick={handleSend}
              className="p-2 bg-brand rounded-full text-white hover:bg-brand/80 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button className="text-gray-500 hover:text-brand transition-colors">
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
