'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useGame, useCurrentPlayer } from '@/context/GameContext';
import { joinRoom, loadSession } from '@/lib/socket';
import { PlayerList } from '@/components/PlayerList';
import { OrganizerPanel, GameStatusBadge } from '@/components/OrganizerPanel';
import { BettingPanel, BankDisplay } from '@/components/BettingPanel';
import { RoundHistory } from '@/components/RoundHistory';

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomIdParam = searchParams.get('room')?.toUpperCase() || '';
  const { room, playerId, playerName, isOrganizer, connected, error, setRoom, setPlayer, leaveGame } =
    useGame();
  const currentPlayer = useCurrentPlayer();
  const [reconnecting, setReconnecting] = useState(true);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  useEffect(() => {
    const tryReconnect = async () => {
      const session = loadSession();
      if (!session && !roomIdParam) {
        setReconnecting(false);
        setReconnectError('Nessuna sessione trovata');
        return;
      }

      const targetRoom = roomIdParam || session?.roomId;
      if (!targetRoom || !session) {
        setReconnecting(false);
        return;
      }

      if (room?.id === targetRoom) {
        setReconnecting(false);
        return;
      }

      try {
        const result = await joinRoom(targetRoom, session.playerName, session.playerId);
        if (result.success && result.room && result.playerId) {
          const player = result.room.players.find((p) => p.id === result.playerId);
          setRoom(result.room);
          setPlayer(result.playerId, session.playerName, player?.isOrganizer ?? session.isOrganizer, targetRoom);
        } else {
          setReconnectError(result.error || 'Impossibile riconnettersi');
        }
      } catch {
        setReconnectError('Errore di connessione al server');
      } finally {
        setReconnecting(false);
      }
    };

    if (connected) tryReconnect();
  }, [connected, roomIdParam, room?.id, setRoom, setPlayer]);

  if (reconnecting) {
    return (
      <div className="page-container flex flex-column align-items-center justify-content-center min-h-screen">
        <ProgressSpinner />
        <p className="mt-3 text-500">Connessione alla partita...</p>
      </div>
    );
  }

  if (!room || reconnectError) {
    return (
      <div className="page-container">
        <Message
          severity="error"
          text={reconnectError || 'Non sei in nessuna partita'}
          className="w-full mb-3"
        />
        <Button label="Torna alla home" icon="pi pi-home" onClick={() => router.push('/')} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h1 className="m-0 text-2xl">
            🍌 Bet My Bananas
          </h1>
          <p className="text-500 m-0 mt-1">
            Stanza <strong>{room.id}</strong>
            {playerName && ` · ${playerName}`}
          </p>
        </div>
        <div className="flex align-items-center gap-2">
          <GameStatusBadge />
          {currentPlayer && (
            <span className="score-badge">{currentPlayer.bananas} 🍌</span>
          )}
        </div>
      </header>

      {error && <Message severity="warn" text={error} className="w-full mb-3" />}

      {room.status === 'lobby' && (
        <Message
          severity="info"
          text={
            isOrganizer
              ? 'Condividi il link e avvia la partita quando tutti sono pronti.'
              : 'In attesa che l\'organizer avvii la partita...'
          }
          className="w-full mb-3"
        />
      )}

      {room.status === 'finished' && (
        <Message severity="success" text="Partita terminata! Ecco la classifica finale." className="w-full mb-3" />
      )}

      <div className="grid">
        <div className="col-12 lg:col-8">
          <BankDisplay />
          <OrganizerPanel />
          <BettingPanel />

          {room.status === 'playing' && !isOrganizer && (
            <div className="player-card p-4 text-center text-500">
              <i className="pi pi-clock text-4xl mb-3" />
              <p>In attesa del prossimo round...</p>
            </div>
          )}
        </div>

        <div className="col-12 lg:col-4">
          <PlayerList players={room.players} currentPlayerId={playerId} />
          <RoundHistory />
          <Button
            label="Esci"
            icon="pi pi-sign-out"
            severity="secondary"
            text
            className="w-full mt-3"
            onClick={() => {
              leaveGame();
              router.push('/');
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="page-container text-center p-5">Caricamento...</div>}>
      <GameContent />
    </Suspense>
  );
}
