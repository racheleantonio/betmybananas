'use client';

import { io, Socket } from 'socket.io-client';
import type { RoomState, SocketResponse } from '@/types/game';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;

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
  }
  return socket;
}

export function connectSocket(): Promise<void> {
  const s = getSocket();
  if (s.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    s.connect();
    s.once('connect', () => resolve());
    s.once('connect_error', (err) => reject(err));
  });
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

function emitWithCallback<T extends SocketResponse>(
  event: string,
  payload?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    s.emit(event, payload ?? {}, (response: T) => {
      if (!response) {
        reject(new Error('No response from server'));
        return;
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

export async function startRound(question: string, options: string[]) {
  return emitWithCallback('round:start', { question, options });
}

export async function placeBet(optionIndex: number, amount: number) {
  return emitWithCallback<{ success: boolean; error?: string; bananas?: number }>('bet:place', {
    optionIndex,
    amount,
  });
}

export async function closeBetting() {
  return emitWithCallback('betting:close');
}

export async function revealWinner(winningOption: number) {
  return emitWithCallback('round:reveal', { winningOption });
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
  callback: (data: { winningOption: number; payouts: Record<string, number>; totalPot: number }) => void
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
