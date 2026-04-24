import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, MoreVertical, Image, Smile, Mic, Reply, X, UserMinus, ShieldCheck, LogOut, Plus, Search, Camera, Pencil, Check, Trash2, User, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { useNotification } from '../../context/NotificationContext';
import { compressImage } from '../../utils/imageCompressor';

type Chat = {
  id: string;
  sender: string;
  avatarColor: string;
  initials: string;
  isOnline: boolean;
  avatar_url?: string;
  isGroup?: boolean;
  targetUserId?: string;
};

interface ConversationProps {
  chat: Chat;
  onBack: () => void;
}

import { socket } from '../../utils/socket';

const isProd = import.meta.env.PROD;
const fallbackUrl = isProd ? window.location.origin : 'http://localhost:10000';
const BACKEND_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || fallbackUrl).replace(/\/$/, '');


const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '👣', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋', '🩸', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'
];


export default function Conversation({ chat, onBack }: ConversationProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Edit States
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [followerSearch, setFollowerSearch] = useState('');
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);

  useEffect(() => {
    // Broad check for avatar URL across possible field names
    const url = chat.avatar_url || (chat as any).avatarUrl || (chat as any).photo_url;
    setGroupAvatar(url || null);
  }, [chat]);

  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentUserIsAdmin = useMemo(() => {
    if (!user) return false;
    const me = groupParticipants.find(p => p.id === user.id);
    return me?.isAdmin || false;
  }, [groupParticipants, user]);

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

    const markAsRead = async () => {
      try {
        await fetch(`${BACKEND_URL}/api/conversations/${chat.id}/read`, {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '' }
        });
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    };

    fetchMessages();
    markAsRead();
    socket.emit('join_room', chat.id);

    const handleNewMessage = (msg: any) => {
      if (msg.senderId !== user?.id) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('new_message', handleNewMessage);
    
    const handleEdited = ({ messageId, text }: any) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text, is_edited: true } : m));
    };
    
    const handleDeleted = ({ messageId }: any) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    socket.on('message_edited', handleEdited);
    socket.on('message_deleted', handleDeleted);

    return () => { 
      socket.off('new_message', handleNewMessage); 
      socket.off('message_edited', handleEdited);
      socket.off('message_deleted', handleDeleted);
    };
  }, [chat.id, user?.id]);

  // Fetch Participants for Group Info
  useEffect(() => {
    if (showGroupInfo && chat.isGroup) {
      fetchParticipants();
    }
  }, [showGroupInfo, chat.id]);

  const fetchParticipants = async () => {
    setLoadingParticipants(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations/${chat.id}/participants`, {
        headers: { 'x-user-id': user?.id || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setGroupParticipants(data);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleGroupAction = async (action: string, targetUserId?: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations/${chat.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({ action, targetUserId })
      });

      if (response.ok) {
        if (action === 'exit' || (action === 'remove' && targetUserId === user?.id)) {
          onBack();
        } else {
          fetchParticipants(); // Refresh list for make-admin or remove-other
        }
      } else {
        const err = await response.json();
        showNotification(err.error || 'Action failed', 'error');
      }
    } catch (err) {
      console.error('Group action failed:', err);
    }
  };

  const handleClearChat = async () => {
    const confirm = window.confirm("Clear all messages in this conversation permanently?");
    if (confirm) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/conversations/${chat.id}/messages`, {
          method: 'DELETE',
          headers: { 'x-user-id': user?.id || '' }
        });
        if (response.ok) {
          setMessages([]);
          showNotification('Conversation cleared permanently', 'success');
        }
      } catch (err) {
        console.error('Error clearing chat:', err);
        showNotification('Failed to clear chat', 'error');
      }
      setShowMenu(false);
    }
  };

  const handleViewProfile = () => {
    if (chat.targetUserId) {
      navigate(`/profile/${chat.targetUserId}`);
    } else {
      showNotification('User profile not found', 'error');
    }
    setShowMenu(false);
  };

  const fetchFollowing = async () => {
    if (!user) return;
    try {
      // Step 1: Get the list of IDs you follow
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id);

      if (followError) throw followError;

      const followingIds = (followData || []).map(f => f.following_id || f.following_user_id).filter(Boolean);

      if (followingIds.length === 0) {
        setFollowingList([]);
        return;
      }

      // Step 2: Fetch profiles for those IDs
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', followingIds);

      if (profileError) throw profileError;

      const profiles = (profileData || []).filter(p => !groupParticipants.find((gp: any) => gp.id === p.id));
      setFollowingList(profiles);
    } catch (err) {
      console.error('Error fetching followers:', err);
    }
  };

  useEffect(() => {
    if (showAddMemberModal) {
      fetchFollowing();
    }
  }, [showAddMemberModal]);

  const handleAddParticipants = async () => {
    if (selectedNewMembers.length === 0) return;
    setAddingMembers(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations/${chat.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({
          action: 'add-members',
          newParticipants: selectedNewMembers
        })
      });

      if (response.ok) {
        setShowAddMemberModal(false);
        setSelectedNewMembers([]);
        fetchParticipants();
      }
    } catch (err) {
      console.error('Add members failed:', err);
    } finally {
      setAddingMembers(false);
    }
  };

  // 2. Scroll to Bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on reply
  useEffect(() => {
    if (replyingTo && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [replyingTo]);

  // 3. Send Message
  const handleSend = async (text?: string, imageUrl?: string, voiceUrl?: string) => {
    const content = text || newMessage;
    if (!content.trim() && !imageUrl && !voiceUrl) return;
    if (!user || !chat.id) return;

    const replyId = replyingTo?.id;

    setNewMessage('');
    setShowEmojis(false);

    try {
      const response = await fetch(`${BACKEND_URL}/api/queue-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({
          type: 'MESSAGE',
          payload: {
            conversationId: chat.id,
            text: content,
            imageUrl: imageUrl,
            voiceUrl: voiceUrl,
            replyToId: replyId
          }
        })
      });

      if (response.ok) {
        // Optimistic UI update
        const sentMsg = {
          id: Math.random().toString(36).substring(7),
          senderId: user.id,
          text: content,
          image_url: imageUrl,
          voice_url: voiceUrl,
          timestamp: new Date().toISOString(),
          reply_to: replyingTo ? (Array.isArray(replyingTo) ? replyingTo : [replyingTo]) : null
        };
        setMessages(prev => [...prev, sentMsg]);
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Handle Edit Message
  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) {
      setEditingMessageId(null);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/queue-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({ 
          type: 'MESSAGE_UPDATE', 
          payload: { action: 'edit', messageId, text: editContent.trim(), conversationId: chat.id } 
        })
      });

      if (response.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: editContent.trim(), is_edited: true } : m));
        setEditingMessageId(null);
      } else {
        alert("Failed to edit message");
      }
    } catch (err) {
      console.error('Error editing message:', err);
    }
  };

  // Handle Delete Message
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;

    // 1. Optimistic Update: Remove from UI instantly
    const messageToDelete = messages.find(m => m.id === messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));

    try {
      const response = await fetch(`${BACKEND_URL}/api/queue-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({ 
          type: 'MESSAGE_UPDATE', 
          payload: { action: 'delete', messageId, conversationId: chat.id } 
        })
      });

      if (!response.ok) throw new Error('Failed to delete');
      
    } catch (err) {
      console.error('Deletion failed:', err);
      alert("Permission denied or message already deleted.");
      if (messageToDelete) {
        setMessages(prev => [...prev, messageToDelete].sort((a,b) => 
          new Date(a.timestamp || a.created_at || Date.now()).getTime() - 
          new Date(b.timestamp || b.created_at || Date.now()).getTime()
        ));
      }
    }
  };

  // 4. Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, compressedFile);

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

  // Group Avatar Upload
  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !chat.isGroup) return;

    // Show local preview immediately for instant feedback
    const previewUrl = URL.createObjectURL(file);
    setGroupAvatar(previewUrl);

    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const fileName = `groups/${chat.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile);

      if (uploadError) {
        alert(`Upload failed: ${uploadError.message}`);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Direct Update via Supabase (Requires the 'avatar_url' column to be added via SQL)
      const { error: dbError } = await supabase
        .from('conversations')
        .update({ avatar_url: publicUrl })
        .eq('id', chat.id);

      if (dbError) {
        showNotification(`Database update failed. Have you run the SQL migration?\nError: ${dbError.message}`, 'error');
        throw dbError;
      }

      // Also try API for webhook/socket triggers if supported
      await fetch(`${BACKEND_URL}/api/conversations/${chat.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({
          action: 'update-avatar',
          avatarUrl: publicUrl
        })
      }).catch(err => console.log('API trigger failed, but DB update succeeded:', err));

      setGroupAvatar(publicUrl);
    } catch (err) {
      console.error('Error updating group avatar:', err);
      // Revert to old avatar if everything failed
      const oldUrl = chat.avatar_url || (chat as any).avatarUrl || (chat as any).photo_url;
      setGroupAvatar(oldUrl || null);
    } finally {
      setUploading(false);
    }
  };

  // 5. Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `${user?.id}/voice-${Date.now()}.webm`;

        setUploading(true);
        const { error } = await supabase.storage
          .from('message-attachments')
          .upload(fileName, audioBlob);

        if (!error) {
          const { data } = supabase.storage.from('message-attachments').getPublicUrl(fileName);
          await handleSend('', '', data.publicUrl);
        }
        setUploading(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(false);

  useEffect(() => {
    if (chat.targetUserId && user) {
      const checkBlockStatus = async () => {
        const { data } = await supabase.from('blocks').select('*').eq('blocker_id', user.id).eq('blocked_id', chat.targetUserId).maybeSingle();
        setIsBlocked(!!data);
      };
      checkBlockStatus();
    }
  }, [chat.targetUserId, user]);

  const handleToggleBlock = async () => {
    if (!chat.targetUserId || !user || checkingBlock) return;
    setCheckingBlock(true);
    const action = isBlocked ? 'unblock' : 'block';
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/queue-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ type: 'BLOCK', payload: { targetId: chat.targetUserId, action } })
      });
      if (response.ok) {
        setIsBlocked(!isBlocked);
        showNotification(isBlocked ? 'User unblocked' : 'User blocked', isBlocked ? 'info' : 'warning');
      }
    } catch (err) {
      console.error('Block failed:', err);
    } finally {
      setCheckingBlock(false);
      setShowMenu(false);
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
        <div className="flex items-center gap-3 flex-1">
          <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div
            className={`flex items-center gap-3 cursor-pointer p-1 pr-4 rounded-xl transition-colors hover:bg-gray-800/50 ${chat.isGroup ? 'flex-1' : ''}`}
            onClick={() => chat.isGroup && setShowGroupInfo(true)}
          >
            <div className="relative">
              {/* FIX: Use avatar_url in the main chat header */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${!chat.avatar_url ? chat.avatarColor : 'bg-gray-800'} shadow-inner overflow-hidden`}>
                {chat.avatar_url ? (
                  <img src={chat.avatar_url} alt={chat.sender} className="w-full h-full object-cover" />
                ) : (
                  chat.initials
                )}
              </div>
              {!chat.isGroup && chat.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#121B22] rounded-full shadow-sm" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white truncate">{chat.sender}</h3>
              <p className="text-xs text-gray-500 font-medium">
                {chat.isGroup ? 'Tap for group info' : (chat.isOnline ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => chat.isGroup ? setShowGroupInfo(true) : setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors cursor-pointer"
          >
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>

          <AnimatePresence>
            {showMenu && !chat.isGroup && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMenu(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[#121B22]/95 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden py-2"
                >
                  <button 
                    onClick={handleViewProfile}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-white transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-gray-400" /> View Profile
                  </button>
                  <button 
                    onClick={() => {
                        showNotification('Muted successfully', 'info');
                        setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-white transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4 text-gray-400" /> Mute Notifications
                  </button>
                  <div className="h-px bg-white/5 my-1" />
                  <button 
                    onClick={handleClearChat}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Clear Chat
                  </button>
                  <button 
                    onClick={handleToggleBlock}
                    disabled={checkingBlock}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-red-500 font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    < ShieldCheck className="w-4 h-4" /> {isBlocked ? 'Unblock User' : 'Block User'}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800 z-0"
      >
        {messages.map((msg) => {
          const msgSenderId = msg.senderid || msg.senderId;
          const isMe = msgSenderId === user?.id;
          const quote = Array.isArray(msg.reply_to) ? msg.reply_to[0] : msg.reply_to;

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`group relative max-w-[80%] px-4 py-2.5 rounded-2xl shadow-sm ${isMe
                ? 'bg-brand/95 text-brand-contrast rounded-tr-sm'
                : 'bg-gray-800 text-white rounded-tl-sm border border-gray-800/50'
                }`}>
                {/* SENDER NAME IN GROUPS */}
                {chat.isGroup && !isMe && (
                  <p className="text-[11px] font-black text-brand mb-1 uppercase tracking-wider">
                    {msg.author?.full_name || msg.author?.username || msg.sender_name || 'User'}
                  </p>
                )}

                {/* QUOTED REPLY RENDER */}
                {quote && (
                  <div className={`mb-2 p-2 rounded-lg border-l-4 text-[11px] min-w-[120px] ${isMe ? 'bg-black/30 border-brand' : 'bg-black/20 border-gray-500'
                    }`}>
                    {/* Name: Show always in Groups, or if it isn't "me" in Private */}
                    {(chat.isGroup || (quote.senderid || quote.senderId) !== user?.id) && (
                      <p className={`font-bold mb-0.5 ${isMe ? 'text-brand' : 'text-gray-400'}`}>
                        {(quote.senderid || quote.senderId) === user?.id ? 'You' : (quote.author?.full_name || quote.author?.username || chat.sender)}
                      </p>
                    )}
                    {/* Special case: If Private and its "You", show "You" anyway */}
                    {!chat.isGroup && (quote.senderid || quote.senderId) === user?.id && (
                      <p className={`font-bold mb-0.5 text-brand`}>You</p>
                    )}

                    <div className="flex items-center gap-1 opacity-90 text-white">
                      {quote.image_url && <Image size={10} className="text-gray-400" />}
                      {quote.voice_url && <Mic size={10} className="text-gray-400" />}
                      <span className="line-clamp-2 italic">
                        {quote.text || (quote.image_url ? '📷 Photo' : quote.voice_url ? '🎤 Voice message' : 'Message')}
                      </span>
                    </div>
                  </div>
                )}

                {msg.image_url && msg.image_url.startsWith('http') && (
                  <img src={msg.image_url} alt="Attached" className="rounded-lg mb-2 max-w-full h-auto cursor-pointer hover:opacity-90" onClick={() => window.open(msg.image_url, '_blank')} />
                )}

                {msg.voice_url && msg.voice_url.startsWith('http') && (
                  <div className="mb-2">
                    <audio src={msg.voice_url} controls className="h-8 max-w-[200px] bg-transparent invert rounded-full" />
                  </div>
                )}

                {/* EDIT OR DISPLAY TEXT */}
                {editingMessageId === msg.id ? (
                  <div className="flex flex-col gap-2 mt-1 min-w-[200px]">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className={`w-full dark:bg-gray-700 bg-black/20 border border-black/10 rounded-xl p-2 text-sm outline-none resize-none ${isMe ? 'dark:text-white' : 'text-white'}`}
                      autoFocus
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingMessageId(null)} className="p-1.5  dark:hover:bg-gray-300 rounded-full transition-colors">
                        <X size={14} className='hover:text-red-400' />
                      </button>
                      <button onClick={() => handleEditMessage(msg.id)} disabled={!editContent.trim()} className="p-1.5 dark:hover:bg-gray-300 rounded-full transition-colors disabled:opacity-50">
                        <Check size={14} className='hover:text-green-400' />
                      </button>
                    </div>
                  </div>
                ) : (
                  msg.text && (
                    <p className="text-sm font-medium leading-relaxed">
                      {msg.text}
                      {msg.is_edited && <span className="text-[10px] italic opacity-60 ml-2">(edited)</span>}
                    </p>
                  )
                )}
                <div className="flex items-center justify-between gap-4 mt-1">
                  <p className={`text-[10px] font-semibold ${isMe ? 'opacity-60' : 'text-gray-500'}`}>
                    {new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {/* Action Icons (Hover triggers) */}
                    <div className="flex items-center gap-2">
                      {isMe && editingMessageId !== msg.id && (
                        <>
                          <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.text || ''); }} className="text-gray-400/50 hover:text-yellow-400 transition-all p-1" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteMessage(msg.id)} className="text-gray-400/50 hover:text-red-400 transition-all p-1" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      <button onClick={() => setReplyingTo(msg)} className="text-gray-400/50 hover:text-blue-400 transition-all p-1" title="Reply">
                        <Reply size={14} />
                      </button>
                    </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* REPLY PREVIEW */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 10 }}
            className="px-4 py-3 border-t border-white/5 bg-gray-950/80 flex items-center justify-between gap-4 backdrop-blur-xl"
          >
            <div className="flex-1 border-l-4 border-brand pl-3 py-1.5 bg-white/5 rounded-r-2xl">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-brand font-bold mb-1">
                  Replying to {(replyingTo.senderid || replyingTo.senderId) === user?.id ? 'You' : (replyingTo.author?.full_name || chat.sender)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-gray-400">
                {replyingTo.image_url && <Image size={12} />}
                <p className="line-clamp-1 italic font-medium">
                  {replyingTo.text || (replyingTo.image_url ? 'Photo' : replyingTo.voice_url ? 'Voice message' : 'Message')}
                </p>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-gray-800 rounded-full transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-transparent z-10">
        <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-800 rounded-2xl px-3 py-1.5 shadow-inner">
          <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className={`p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-all ${uploading ? 'animate-pulse' : ''}`}>
            <Image className="w-5 h-5" />
          </button>
          <button onClick={() => setShowEmojis(!showEmojis)} className={`p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-all relative ${showEmojis ? 'text-brand bg-brand/10' : ''}`}>
            <Smile className="w-5 h-5" />

            {/* Emoji Picker Popup */}
            <AnimatePresence>
              {showEmojis && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-full mb-4 left-0 w-[280px] sm:w-[320px] bg-[#121B22]/95 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl overflow-hidden z-[120]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3 border-b border-white/5 bg-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Popular Emojis</p>
                  </div>
                  <div className="p-2 grid grid-cols-8 gap-1 max-h-[250px] overflow-y-auto custom-scrollbar">
                    {COMMON_EMOJIS.map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setNewMessage(prev => prev + emoji);
                          // Optional: Keep open for multiple emojis
                        }}
                        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 hover:bg-white/10 rounded-xl transition-all text-xl"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 border-t border-white/5 bg-white/5 flex justify-end">
                    <button
                      onClick={() => setShowEmojis(false)}
                      className="text-xs font-bold text-[#00A884] hover:underline"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          <input
            ref={messageInputRef}
            type="text"
            placeholder={isRecording ? "Recording voice..." : uploading ? "Uploading..." : "Type a message..."}
            value={newMessage}
            disabled={uploading || isRecording}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-transparent border-none outline-none text-white text-[15px] py-2 placeholder-gray-500"
          />
          {newMessage ? (
            <button onClick={() => handleSend()} className="p-2.5 bg-brand rounded-full text-brand-contrast hover:opacity-90 transition-all shadow-lg active:scale-95">
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          ) : (
            <button onClick={isRecording ? stopRecording : startRecording} className={`p-2.5 rounded-full transition-all duration-300 hover:bg-white/5 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-white'}`}>
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Group Info Panel Overlay */}
      <AnimatePresence>
        {showGroupInfo && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 150 }}
            className="absolute inset-0 z-[100] bg-[#0B0E11] flex flex-col shadow-2xl"
          >
            {/* Group Info Header */}
            <div className="p-5 border-b border-gray-800/50 flex items-center justify-between bg-[#121B22] sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowGroupInfo(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-300" />
                </button>
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-white leading-tight">Group Info</h3>
                  <p className="text-[11px] text-gray-500 font-medium uppercase tracking-widest">Details</p>
                </div>
              </div>
              <button onClick={() => setShowGroupInfo(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Profile Hero Section - WhatsApp Style */}
              <div className="flex flex-col items-center pt-8 pb-10 bg-[#121B22] border-b border-gray-800/50">
                <div className="relative mb-6">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`w-40 h-40 rounded-full flex items-center justify-center text-white font-bold text-6xl ${chat.avatarColor} shadow-2xl ring-4 ring-white/5 overflow-hidden`}
                  >
                    {groupAvatar ? (
                      <img src={groupAvatar} className="w-full h-full object-cover" />
                    ) : (
                      chat.initials
                    )}
                  </motion.div>

                  {/* Admin Camera Overlay */}
                  {currentUserIsAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => groupAvatarInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute bottom-1 right-1 p-3 bg-[#00A884] rounded-full text-white shadow-xl hover:bg-[#008F6F] transition-all border-4 border-[#121B22] z-30"
                      title="Change Group Photo"
                    >
                      <Camera className={`w-6 h-6 ${uploading ? 'animate-spin' : ''}`} />
                      <input
                        type="file"
                        ref={groupAvatarInputRef}
                        onChange={handleGroupAvatarUpload}
                        className="hidden"
                        accept="image/*"
                      />
                    </motion.button>
                  )}
                </div>
                <div className="text-center px-6">
                  <h2 className="text-3xl font-black text-white mb-1">{chat.sender}</h2>
                  <p className="text-gray-400 font-medium text-sm">
                    {groupParticipants.length > 0
                      ? `Group · ${groupParticipants.length} ${groupParticipants.length === 1 ? 'member' : 'members'}`
                      : 'Fetching members...'
                    }
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-10">
                {/* About/Description Placeholder */}
                <div className="space-y-2">
                  <h4 className="text-[12px] font-bold uppercase tracking-widest text-[#00A884]">About</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    This is a private group conversation. Only members added by administrators can view and send messages here.
                  </p>
                </div>

                {/* Members Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800/30 pb-2">
                    <h4 className="text-[12px] font-bold uppercase tracking-widest text-gray-500">
                      {groupParticipants.length} Participants
                    </h4>
                    <button
                      onClick={() => setShowMemberSearch(!showMemberSearch)}
                      className={`p-1.5 rounded-lg transition-colors ${showMemberSearch ? 'bg-brand/20 text-brand' : 'text-[#00A884] hover:bg-white/5'}`}
                    >
                      <Search size={18} />
                    </button>
                  </div>

                  {showMemberSearch && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="relative px-1"
                    >
                      <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search existing members..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-brand transition-all"
                        autoFocus
                      />
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    {/* Add Member Shortcut */}
                    {!memberSearch && (
                      <button
                        onClick={() => setShowAddMemberModal(true)}
                        className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-[#00A884] font-bold text-sm"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#00A884]/20 flex items-center justify-center">
                          <Plus className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span>Add Participant</span>
                          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Invite friends to group</span>
                        </div>
                      </button>
                    )}

                    {loadingParticipants && groupParticipants.length === 0 ? (
                      <div className="py-20 flex flex-col items-center gap-4 opacity-50">
                        <div className="w-8 h-8 border-3 border-[#00A884] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Synchronizing...</span>
                      </div>
                    ) : (
                      groupParticipants
                        .filter(m =>
                          memberSearch === '' ||
                          m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                          m.username.toLowerCase().includes(memberSearch.toLowerCase())
                        )
                        .map((member) => {
                          const isMe = member.id === user?.id;
                          const myProfile = groupParticipants.find(p => p.id === user?.id);
                          const iAmAdmin = myProfile?.isAdmin;

                          return (
                            <div key={member.id} className="group/member flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5">
                              <div className="relative">
                                <img src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.username}`} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10" alt={member.full_name} />
                                {member.isAdmin && (
                                  <div className="absolute -bottom-1 -right-1 bg-brand p-0.5 rounded-full border border-gray-900">
                                    <ShieldCheck size={10} className="text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-white truncate text-base">{member.full_name} {isMe && <span className="text-[#00A884] text-xs ml-1">(You)</span>}</p>
                                </div>
                                <p className="text-xs text-gray-500 font-medium">@{member.username}</p>
                              </div>

                              {member.isAdmin && (
                                <span className="px-2 py-0.5 bg-[#00A884]/10 text-[#00A884] text-[9px] font-black uppercase rounded border border-[#00A884]/20">Admin</span>
                              )}

                              {/* Admin Controls */}
                              {iAmAdmin && !isMe && (
                                <div className="hidden group-hover/member:flex items-center gap-1 transition-all">
                                  {!member.isAdmin && (
                                    <button
                                      onClick={() => handleGroupAction('make-admin', member.id)}
                                      className="p-2 hover:bg-[#00A884]/10 text-[#00A884] rounded-lg transition-colors"
                                      title="Make Admin"
                                    >
                                      <ShieldCheck size={20} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleGroupAction('remove', member.id)}
                                    className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                    title="Remove Member"
                                  >
                                    <UserMinus size={20} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Exit Group Section */}
                <div className="pt-8 border-t border-gray-800 space-y-4">
                  <motion.button
                    whileHover={{ x: 5 }}
                    onClick={() => handleGroupAction('exit')}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl text-[#EA0038] font-bold hover:bg-[#EA0038]/10 transition-all border border-[#EA0038]/20 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#EA0038]/10 flex items-center justify-center group-hover:bg-[#EA0038]/20">
                      <LogOut size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-base">Exit Group</p>
                      <p className="text-[10px] text-[#EA0038]/60 uppercase tracking-widest font-black">Archive Conversation</p>
                    </div>
                  </motion.button>
                  
                  {currentUserIsAdmin && (
                    <motion.button
                      whileHover={{ x: 5 }}
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to completely delete this group? This cannot be undone.")) {
                          try {
                            const response = await fetch(`${BACKEND_URL}/api/conversations/${chat.id}`, {
                              method: 'DELETE',
                              headers: { 'x-user-id': user?.id || '' }
                            });
                            if (response.ok) {
                              onBack();
                            } else {
                              const err = await response.json();
                              showNotification(err.error || 'Failed to delete group', 'error');
                            }
                          } catch (err) {
                            showNotification('Error deleting group', 'error');
                          }
                        }
                      }}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl text-red-500 font-bold hover:bg-red-500/10 transition-all border border-red-500/20 group mt-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20">
                        <Trash2 size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-base">Delete Group</p>
                        <p className="text-[10px] text-red-500/60 uppercase tracking-widest font-black">Permanently delete for everyone</p>
                      </div>
                    </motion.button>
                  )}
                </div>

                {/* Footer Quote */}
                <div className="text-center py-6 opacity-20">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">End-to-end encrypted</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Participants Modal Overlay */}
      <AnimatePresence>
        {showAddMemberModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddMemberModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-sm bg-[#121B22] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] border border-white/5"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Add Members</h3>
                <button onClick={() => setShowAddMemberModal(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>

              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search followers..."
                    value={followerSearch}
                    onChange={(e) => setFollowerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-white text-sm outline-none focus:ring-1 focus:ring-[#00A884]"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                {followingList.filter(u => u.full_name.toLowerCase().includes(followerSearch.toLowerCase())).map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedNewMembers(prev => prev.includes(profile.id) ? prev.filter(id => id !== profile.id) : [...prev, profile.id])}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${selectedNewMembers.includes(profile.id) ? 'bg-[#00A884]/10' : 'hover:bg-white/5'
                      }`}
                  >
                    <img src={profile.avatar_url} className="w-10 h-10 rounded-full" alt={profile.full_name} />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-white">{profile.full_name}</p>
                      <p className="text-gray-500 text-xs">@{profile.username}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedNewMembers.includes(profile.id) ? 'bg-[#00A884] border-[#00A884]' : 'border-gray-600'
                      }`}>
                      {selectedNewMembers.includes(profile.id) && <ShieldCheck size={14} className="text-white" />}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-white/5 bg-[#0B141A]">
                <button
                  disabled={selectedNewMembers.length === 0 || addingMembers}
                  onClick={handleAddParticipants}
                  className="w-full py-3 bg-[#00A884] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                >
                  {addingMembers ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `Add ${selectedNewMembers.length} Members`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
