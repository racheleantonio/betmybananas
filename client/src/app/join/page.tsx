'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from 'primereact/card';
import { Message } from 'primereact/message';
import { JoinRoomForm } from '@/components/JoinRoomForm';
import { useGame } from '@/context/GameContext';

function JoinContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || '';
  const { connected, error } = useGame();

  return (
    <div className="page-container">
      <header className="banana-header">
        <span className="banana-emoji">🍌</span>
        <h1>Unisciti alla partita</h1>
        <p>Inserisci il tuo nome e inizia a scommettere banane!</p>
      </header>

      {!connected && !error && (
        <Message severity="info" text="Connessione al server in corso..." className="w-full mb-3" />
      )}
      {error && <Message severity="error" text={error} className="w-full mb-3" />}

      <Card className="player-card">
        {roomId ? (
          <Message
            severity="success"
            text={`Sei stato invitato alla stanza ${roomId.toUpperCase()}`}
            className="w-full mb-3"
          />
        ) : (
          <Message severity="warn" text="Codice stanza mancante nel link" className="w-full mb-3" />
        )}
        <JoinRoomForm initialRoomId={roomId.toUpperCase()} />
      </Card>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="page-container text-center p-5">Caricamento...</div>}>
      <JoinContent />
    </Suspense>
  );
}
