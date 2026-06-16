'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { RoomState } from '@/types/game';
import {
  getSocket,
  connectSocket,
  onRoomState,
  onOrganizerDisconnected,
  loadSession,
  saveSession,
  clearSession,
} from '@/lib/socket';
import { clientLog, clientWarn } from '@/lib/logger';

interface GameContextValue {
  room: RoomState | null;
  playerId: string | null;
  playerName: string | null;
  isOrganizer: boolean;
  connected: boolean;
  error: string | null;
  setRoom: (room: RoomState | null) => void;
  setPlayer: (playerId: string, playerName: string, isOrganizer: boolean, roomId: string) => void;
  setError: (error: string | null) => void;
  leaveGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPlayer = useCallback(
    (id: string, name: string, organizer: boolean, roomId: string) => {
      setPlayerId(id);
      setPlayerName(name);
      setIsOrganizer(organizer);
      saveSession(roomId, id, name, organizer);
    },
    []
  );

  const leaveGame = useCallback(() => {
    clearSession();
    setRoom(null);
    setPlayerId(null);
    setPlayerName(null);
    setIsOrganizer(false);
    getSocket().disconnect();
    setConnected(false);
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setPlayerId(session.playerId);
      setPlayerName(session.playerName);
      setIsOrganizer(session.isOrganizer);
    }

    connectSocket()
      .then(() => {
        clientLog('GameProvider connected');
        setConnected(true);
      })
      .catch((err) => {
        clientWarn('GameProvider connection failed', { message: err?.message });
        setError('Unable to connect to game server');
      });

    const socket = getSocket();
    const onConnect = () => {
      clientLog('GameProvider socket connect event');
      setConnected(true);
      setError(null);
    };
    const onDisconnect = (reason: string) => {
      clientWarn('GameProvider socket disconnect event', { reason });
      setConnected(false);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const unsubState = onRoomState((state) => {
      clientLog('Room state updated', {
        roomId: state.id,
        status: state.status,
        players: state.players.length,
        roundNumber: state.roundNumber,
        bank: state.bank,
      });
      setRoom(state);
    });
    const unsubOrg = onOrganizerDisconnected(() => {
      clientWarn('Organizer disconnected');
      setError('Organizer disconnected. Waiting for reconnection...');
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      unsubState();
      unsubOrg();
    };
  }, []);

  return (
    <GameContext.Provider
      value={{
        room,
        playerId,
        playerName,
        isOrganizer,
        connected,
        error,
        setRoom,
        setPlayer,
        setError,
        leaveGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export function useCurrentPlayer() {
  const { room, playerId } = useGame();
  return room?.players.find((p) => p.id === playerId) ?? null;
}
