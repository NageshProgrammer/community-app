import { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, MoreVertical, Image, Smile, Mic, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { supabase } from '../../utils/supabase';

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

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:10000').replace(/\/$/, '');
const socket = io(BACKEND_URL);

export default function Conversation({ chat, onBack }: ConversationProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch History
  useEffect(() => {
    if (!chat.id) return;

    const fetchMessages = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/messages/${chat.id}`, {
          headers: { 'x-user-id': user?.id || '' }
        });
        const data = await response.json();
        setMessages(data);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages();
    socket.emit('join_room', chat.id);

    const handleNewMessage = (msg: any) => {
      if (msg.senderId !== user?.id) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => { socket.off('new_message', handleNewMessage); };
  }, [chat.id, user?.id]);

  // 2. Scroll to Bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 3. Send Message
  const handleSend = async (text?: string, imageUrl?: string) => {
    const content = text || newMessage;
    if (!content.trim() && !imageUrl) return;
    if (!user || !chat.id) return;
    
    setNewMessage('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id 
        },
        body: JSON.stringify({
          conversationId: chat.id,
          text: content,
          imageUrl: imageUrl
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

  // 4. Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(fileName);

      await handleSend('', urlData.publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  // 5. Toggle Message Like
  const toggleMessageLike = async (messageId: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const isLiked = msg.isLiked;
    try {
      if (isLiked) {
        await supabase.from('message_likes').delete().match({ message_id: messageId, user_id: user.id });
      } else {
        await supabase.from('message_likes').insert({ message_id: messageId, user_id: user.id });
      }
      
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isLiked: !isLiked } : m));
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col h-[calc(100vh-140px)] bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl relative"
    >
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-transparent z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${chat.avatarColor} shadow-inner`}>
              {chat.initials}
            </div>
            {chat.isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-transparent rounded-full shadow-sm" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-white">{chat.sender}</h3>
            <p className="text-xs text-gray-500 font-medium">{chat.isOnline ? 'Online' : 'Offline'}</p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <MoreVertical className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800 z-0"
      >
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`group relative max-w-[80%] px-4 py-2.5 rounded-2xl shadow-sm ${
                isMe 
                  ? 'bg-brand/95 text-brand-contrast rounded-tr-sm' 
                  : 'bg-gray-800 text-white rounded-tl-sm border border-gray-800/50'
              }`}>
                {msg.image_url && (
                  <img src={msg.image_url} alt="Attached" className="rounded-lg mb-2 max-w-full h-auto cursor-pointer hover:opacity-90" onClick={() => window.open(msg.image_url, '_blank')} />
                )}
                {msg.text && <p className="text-sm font-medium leading-relaxed">{msg.text}</p>}
                
                <div className="flex items-center justify-between gap-4 mt-1">
                  <p className={`text-[10px] font-semibold ${isMe ? 'opacity-60' : 'text-gray-500'}`}>
                    {new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  
                  <button 
                    onClick={() => toggleMessageLike(msg.id)}
                    className={`transition-all duration-300 transform active:scale-150 ${msg.isLiked ? 'text-pink-500' : 'text-gray-500 opacity-0 group-hover:opacity-100'}`}
                  >
                    <Heart size={12} fill={msg.isLiked ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-transparent z-10">
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-800 rounded-2xl px-4 py-2 shadow-inner">
          <button 
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className={`text-gray-500 hover:text-brand transition-colors ${uploading ? 'animate-pulse' : ''}`}
          >
            <Image className="w-5 h-5" />
          </button>
          <button className="text-gray-500 hover:text-brand transition-colors">
            <Smile className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            placeholder={uploading ? "Uploading image..." : "Type a message..."}
            value={newMessage}
            disabled={uploading}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-transparent border-none outline-none text-white text-sm py-2 placeholder-gray-500"
          />
          {newMessage ? (
            <button 
              onClick={() => handleSend()}
              className="p-2 bg-brand rounded-full text-brand-contrast hover:opacity-90 transition-opacity shadow-md"
            >
              <Send className="w-4 h-4 ml-0.5" />
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