'use client';

import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { joinRoom } from '@/lib/socket';

interface JoinRoomFormProps {
  initialRoomId?: string;
}

export function JoinRoomForm({ initialRoomId = '' }: JoinRoomFormProps) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId);
  const [loading, setLoading] = useState(false);
  const { setRoom, setPlayer, setError } = useGame();
  const router = useRouter();
  const toast = useRef<Toast>(null);

  const handleJoin = async () => {
    if (!name.trim() || !roomId.trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Campi richiesti',
        detail: 'Inserisci nome e codice stanza',
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await joinRoom(roomId.trim().toUpperCase(), name.trim());
      if (!result.success || !result.room || !result.playerId) {
        toast.current?.show({
          severity: 'error',
          summary: 'Errore',
          detail: result.error || 'Impossibile entrare nella stanza',
        });
        return;
      }

      const player = result.room.players.find((p) => p.id === result.playerId);
      setRoom(result.room);
      setPlayer(result.playerId, name.trim(), player?.isOrganizer ?? false, result.room.id);
      router.push(`/game/?room=${result.room.id}`);
    } catch {
      toast.current?.show({
        severity: 'error',
        summary: 'Errore di connessione',
        detail: 'Verifica che il server sia attivo',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toast ref={toast} />
      <div className="flex flex-column gap-3">
        <div>
          <label htmlFor="room-id">Codice stanza</label>
          <InputText
            id="room-id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            placeholder="Es. A1B2C3D4"
            className="w-full mt-1"
          />
        </div>
        <div>
          <label htmlFor="player-name">Il tuo nome</label>
          <InputText
            id="player-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Luigi"
            className="w-full mt-1"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
        </div>
        <Button
          label="Entra nella partita"
          icon="pi pi-sign-in"
          onClick={handleJoin}
          loading={loading}
          className="w-full"
        />
      </div>
    </>
  );
}
