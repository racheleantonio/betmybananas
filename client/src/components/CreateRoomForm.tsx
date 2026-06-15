'use client';

import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { createRoom, getShareUrl } from '@/lib/socket';

export function CreateRoomForm() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { setRoom, setPlayer, setError } = useGame();
  const router = useRouter();
  const toast = useRef<Toast>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.current?.show({ severity: 'warn', summary: 'Nome richiesto', detail: 'Inserisci il tuo nome' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createRoom(name.trim());
      if (!result.success || !result.room || !result.playerId) {
        toast.current?.show({
          severity: 'error',
          summary: 'Errore',
          detail: result.error || 'Impossibile creare la stanza',
        });
        return;
      }

      setRoom(result.room);
      setPlayer(result.playerId, name.trim(), true, result.room.id);
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
        <label htmlFor="organizer-name">Il tuo nome (organizer)</label>
        <InputText
          id="organizer-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Mario"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <Button
          label="Crea partita"
          icon="pi pi-plus"
          onClick={handleCreate}
          loading={loading}
          className="w-full"
        />
      </div>
    </>
  );
}

export function ShareLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const url = getShareUrl(roomId);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-column gap-2 mt-3">
      <label>Link per invitare i giocatori</label>
      <div className="share-link-box">{url}</div>
      <Button
        label={copied ? 'Copiato!' : 'Copia link'}
        icon={copied ? 'pi pi-check' : 'pi pi-copy'}
        severity="secondary"
        outlined
        onClick={copyLink}
      />
    </div>
  );
}
