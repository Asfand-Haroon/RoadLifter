import { io, Socket } from 'socket.io-client';

export const getWsUrl = (): string => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return 'http://localhost:5000';
    }
  }
  return process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'https://sharp-parents-glow.loca.lt';
};

let socket: Socket | null = null;

export const getSocket = (token?: string): Socket => {
  const wsUrl = getWsUrl();
  if (!socket || !socket.connected) {
    socket = io(wsUrl, {
      auth: { token: token || (typeof window !== 'undefined' ? localStorage.getItem('rl_token') : '') },
      extraHeaders: {
        'bypass-tunnel-reminder': 'true',
        'ngrok-skip-browser-warning': 'true',
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected to', wsUrl, socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('🔌 Socket connection error:', err.message);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default getSocket;
