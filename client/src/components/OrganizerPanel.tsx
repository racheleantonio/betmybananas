'use client';

import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { useRef, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { startGame, startRound, endRound, endGame } from '@/lib/socket';
import { ShareLink } from './CreateRoomForm';

const STATUS_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  playing: 'In attesa del round',
  betting: 'Puntate aperte',
  revealed: 'Round concluso',
  finished: 'Partita terminata',
};

export function OrganizerPanel() {
  const { room, isOrganizer } = useGame();
  const [loading, setLoading] = useState(false);
  const toast = useRef<Toast>(null);

  if (!isOrganizer || !room) return null;

  const showToast = (severity: 'success' | 'error' | 'warn', summary: string, detail?: string) => {
    toast.current?.show({ severity, summary, detail, life: 3000 });
  };

  const handleStartGame = async () => {
    setLoading(true);
    const result = await startGame();
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else showToast('success', 'Partita avviata!');
  };

  const handleStartRound = async () => {
    setLoading(true);
    const result = await startRound();
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else showToast('success', 'Round avviato!');
  };

  const handleEndRound = async () => {
    setLoading(true);
    const result = await endRound();
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else showToast('success', 'Round concluso!');
  };

  const handleEndGame = async () => {
    setLoading(true);
    const result = await endGame();
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else showToast('success', 'Partita terminata');
  };

  return (
    <>
      <Toast ref={toast} />
      <div className="player-card p-4 mb-3">
        <h3 className="mt-0 text-yellow-400">
          <i className="pi pi-cog mr-2" />
          Pannello Organizer
        </h3>

        {room.status === 'lobby' && (
          <>
            <ShareLink roomId={room.id} />
            <p className="text-500 mt-3">
              Giocatori connessi: {room.players.length}. Servono almeno 2 per iniziare.
            </p>
            <Button
              label="Avvia partita"
              icon="pi pi-play"
              onClick={handleStartGame}
              loading={loading}
              disabled={room.players.length < 2}
              className="mt-2"
            />
          </>
        )}

        {(room.status === 'playing' || room.status === 'revealed') && (
          <Button
            label="Inizia round"
            icon="pi pi-forward"
            onClick={handleStartRound}
            loading={loading}
            className="mt-3"
          />
        )}

        {room.status === 'betting' && room.currentRound && (
          <div className="flex flex-column gap-2 mt-3">
            <p className="text-500 m-0">
              Round {room.roundNumber} · Puntate: {room.currentRound.bets.length} / {room.players.length}
            </p>
            <p className="text-500 m-0">
              Banca attuale: {room.bank} 🍌
            </p>
            <Button
              label="Termina round"
              icon="pi pi-flag"
              severity="warning"
              onClick={handleEndRound}
              loading={loading}
              disabled={room.currentRound.bets.length < 2}
            />
            {room.currentRound.bets.length < 2 && (
              <small className="text-500">Servono almeno 2 puntate per chiudere il round.</small>
            )}
          </div>
        )}

        {room.status !== 'lobby' && room.status !== 'finished' && (
          <Button
            label="Termina partita"
            icon="pi pi-stop"
            severity="danger"
            text
            onClick={handleEndGame}
            loading={loading}
            className="mt-4"
          />
        )}
      </div>
    </>
  );
}

export function GameStatusBadge() {
  const { room } = useGame();
  if (!room) return null;

  return (
    <span className={`status-chip status-${room.status}`}>
      <i className="pi pi-circle-fill" style={{ fontSize: '0.5rem' }} />
      {STATUS_LABELS[room.status] || room.status}
      {room.roundNumber > 0 && ` · Round ${room.roundNumber}`}
    </span>
  );
}
