import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, type, message }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      
      {/* Notification Tray */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 w-full max-w-[320px] pointer-events-none">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 10 }}
              className="pointer-events-auto"
            >
              <div className={`
                relative flex items-center gap-3 p-4 pr-10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl border border-white/10 overflow-hidden
                bg-black/80 dark:bg-black/90
              `}>
                {/* Side Accent Bar */}
                <div className={`
                  absolute left-0 top-0 bottom-0 w-1
                  ${notification.type === 'success' ? 'bg-green-500' : ''}
                  ${notification.type === 'error' ? 'bg-red-500' : ''}
                  ${notification.type === 'warning' ? 'bg-amber-400' : ''}
                  ${notification.type === 'info' ? 'bg-blue-500' : ''}
                `} />

                <div className={`
                  flex-shrink-0 
                  ${notification.type === 'success' ? 'text-green-500' : ''}
                  ${notification.type === 'error' ? 'text-red-500' : ''}
                  ${notification.type === 'warning' ? 'text-amber-400' : ''}
                  ${notification.type === 'info' ? 'text-blue-500' : ''}
                `}>
                  {notification.type === 'success' && <CheckCircle size={18} strokeWidth={2.5} />}
                  {notification.type === 'error' && <AlertCircle size={18} strokeWidth={2.5} />}
                  {notification.type === 'warning' && <AlertCircle size={18} strokeWidth={2.5} />}
                  {notification.type === 'info' && <Info size={18} strokeWidth={2.5} />}
                </div>
                
                <p className="flex-1 font-semibold text-[13px] tracking-tight text-white leading-snug">
                  {notification.message}
                </p>

                <button 
                  onClick={() => removeNotification(notification.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
