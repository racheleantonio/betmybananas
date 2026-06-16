'use client';

import { io, Socket } from 'socket.io-client';
import type { RoomState, SocketResponse } from '@/types/game';
import { clientLog, clientWarn, clientError } from '@/lib/logger';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let debugListenersAttached = false;

function attachSocketDebugListeners(s: Socket) {
  if (debugListenersAttached) return;
  debugListenersAttached = true;

  clientLog('Socket client initialized', {
    url: SOCKET_URL,
    transports: ['polling'],
  });

  s.on('connect', () => {
    clientLog('Socket connected', {
      id: s.id,
      transport: s.io.engine.transport.name,
    });
  });

  s.on('disconnect', (reason) => {
    clientWarn('Socket disconnected', { reason });
  });

  s.on('connect_error', (err) => {
    clientError('Socket connect_error', {
      message: err.message,
      type: err.name,
    });
  });

  s.io.on('reconnect_attempt', (attempt) => {
    clientLog('Socket reconnect attempt', { attempt });
  });

  s.io.on('reconnect', (attempt) => {
    clientLog('Socket reconnected', { attempt });
  });

  s.io.on('reconnect_failed', () => {
    clientError('Socket reconnect failed');
  });
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      // SnapDeploy/Cloudflare may block WebSocket upgrades; polling works reliably.
      transports: ['polling'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 20000,
      auth: {
        token: process.env.NEXT_PUBLIC_SOCKET_TOKEN || 'dev',
      },
    });
    attachSocketDebugListeners(socket);
  }
  return socket;
}

export function connectSocket(): Promise<void> {
  const s = getSocket();
  if (s.connected) {
    clientLog('Socket already connected', { id: s.id });
    return Promise.resolve();
  }

  clientLog('Connecting to server...', { url: SOCKET_URL });

  return new Promise((resolve, reject) => {
    s.connect();
    s.once('connect', () => resolve());
    s.once('connect_error', (err) => reject(err));
  });
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    clientLog('Disconnecting socket', { id: socket.id });
    socket.disconnect();
  }
}

function emitWithCallback<T extends SocketResponse>(
  event: string,
  payload?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    clientLog(`Emit ${event}`, payload ?? {});

    s.emit(event, payload ?? {}, (response: T) => {
      if (!response) {
        clientError(`No response for ${event}`);
        reject(new Error('No response from server'));
        return;
      }

      if (response.success) {
        clientLog(`Response ${event}`, { success: true });
      } else {
        clientWarn(`Response ${event}`, { success: false, error: response.error });
      }

      resolve(response);
    });
  });
}

export async function createRoom(name: string) {
  await connectSocket();
  return emitWithCallback<{ success: boolean; error?: string; room?: RoomState; playerId?: string }>(
    'room:create',
    { name }
  );
}

export async function joinRoom(roomId: string, name: string, playerId?: string) {
  await connectSocket();
  return emitWithCallback<{ success: boolean; error?: string; room?: RoomState; playerId?: string }>(
    'room:join',
    { roomId, name, playerId }
  );
}

export async function startGame() {
  return emitWithCallback('game:start');
}

export async function startRound() {
  return emitWithCallback('round:start');
}

export async function placeBet(amount: number) {
  return emitWithCallback<{ success: boolean; error?: string; bananas?: number }>('bet:place', {
    amount,
  });
}

export async function endRound() {
  return emitWithCallback('round:end');
}

export async function endGame() {
  return emitWithCallback('game:end');
}

export function onRoomState(callback: (state: RoomState) => void): () => void {
  const s = getSocket();
  s.on('room:state', callback);
  return () => s.off('room:state', callback);
}

export function onRoundStarted(callback: (data: { roundNumber: number }) => void): () => void {
  const s = getSocket();
  s.on('round:started', callback);
  return () => s.off('round:started', callback);
}

export function onRoundRevealed(
  callback: (data: {
    winnerId: string;
    winningBet: number;
    secondHighestBet: number;
    winnerPayout: number;
    bankIncrease: number;
  }) => void
): () => void {
  const s = getSocket();
  s.on('round:revealed', callback);
  return () => s.off('round:revealed', callback);
}

export function onOrganizerDisconnected(callback: () => void): () => void {
  const s = getSocket();
  s.on('organizer:disconnected', callback);
  return () => s.off('organizer:disconnected', callback);
}

export function saveSession(roomId: string, playerId: string, playerName: string, isOrganizer: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    'betmybananas_session',
    JSON.stringify({ roomId, playerId, playerName, isOrganizer })
  );
}

export function loadSession(): {
  roomId: string;
  playerId: string;
  playerName: string;
  isOrganizer: boolean;
} | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('betmybananas_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('betmybananas_session');
}

export function getShareUrl(roomId: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (typeof window === 'undefined') return `${basePath}/join/?room=${roomId}`;
  return `${window.location.origin}${basePath}/join/?room=${roomId}`;
}
