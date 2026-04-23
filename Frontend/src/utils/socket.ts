import { io } from 'socket.io-client';

const isProd = import.meta.env.PROD;
export const BACKEND_URL = isProd 
  ? (import.meta.env.VITE_BACKEND_URL || window.location.origin).replace(/\/$/, '')
  : 'http://localhost:10000';

// Create the socket instance with preferred transports
export const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'], // Try websocket first
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000,
});

// Helper to authenticate
export const authenticateSocket = (userId: string | undefined) => {
  if (userId) {
    socket.emit('authenticate', userId);
  }
};

export default socket;
