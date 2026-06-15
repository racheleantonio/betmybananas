'use client';

import { Card } from 'primereact/card';
import { TabView, TabPanel } from 'primereact/tabview';
import { Message } from 'primereact/message';
import { CreateRoomForm } from '@/components/CreateRoomForm';
import { JoinRoomForm } from '@/components/JoinRoomForm';
import { useGame } from '@/context/GameContext';

export default function HomePage() {
  const { connected, error } = useGame();

  return (
    <div className="page-container">
      <header className="banana-header">
        <span className="banana-emoji">🍌</span>
        <h1>Bet My Bananas</h1>
        <p>Scommetti le tue banane in tempo reale con gli amici!</p>
      </header>

      {!connected && !error && (
        <Message severity="info" text="Connessione al server in corso..." className="w-full mb-3" />
      )}
      {error && <Message severity="error" text={error} className="w-full mb-3" />}

      <Card className="player-card">
        <TabView>
          <TabPanel header="Crea partita" leftIcon="pi pi-plus mr-2">
            <p className="text-500">
              Crea una nuova stanza e condividi il link con i tuoi amici. Sarai l&apos;organizer.
            </p>
            <CreateRoomForm />
          </TabPanel>
          <TabPanel header="Unisciti" leftIcon="pi pi-sign-in mr-2">
            <p className="text-500">
              Hai ricevuto un link o un codice stanza? Inserisci i tuoi dati per entrare.
            </p>
            <JoinRoomForm />
          </TabPanel>
        </TabView>
      </Card>

      <div className="text-center text-500 mt-4 text-sm">
        <p>Nessuna password richiesta · Accesso immediato · 100 🍌 per giocatore</p>
      </div>
    </div>
  );
}
