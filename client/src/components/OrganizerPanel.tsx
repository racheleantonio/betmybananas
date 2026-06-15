'use client';

import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { useRef, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { startGame, startRound, closeBetting, revealWinner, endGame } from '@/lib/socket';
import { ShareLink } from './CreateRoomForm';

const STATUS_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  playing: 'In attesa del round',
  betting: 'Scommesse aperte',
  revealed: 'Risultato rivelato',
  finished: 'Partita terminata',
};

export function OrganizerPanel() {
  const { room, isOrganizer } = useGame();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
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
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) {
      showToast('warn', 'Compila domanda e almeno 2 opzioni');
      return;
    }
    setLoading(true);
    const result = await startRound(question.trim(), validOptions);
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else {
      showToast('success', 'Round avviato!');
      setQuestion('');
      setOptions(['', '']);
    }
  };

  const handleCloseBetting = async () => {
    setLoading(true);
    const result = await closeBetting();
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else showToast('success', 'Scommesse chiuse');
  };

  const handleReveal = async (winningOption: number) => {
    setLoading(true);
    const result = await revealWinner(winningOption);
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else showToast('success', 'Vincitore rivelato!');
  };

  const handleEndGame = async () => {
    setLoading(true);
    const result = await endGame();
    setLoading(false);
    if (!result.success) showToast('error', 'Errore', result.error);
    else showToast('success', 'Partita terminata');
  };

  const addOption = () => {
    if (options.length < 4) setOptions([...options, '']);
  };

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
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
          <div className="flex flex-column gap-3 mt-3">
            <div>
              <label htmlFor="question">Domanda del round</label>
              <InputTextarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                className="w-full mt-1"
                placeholder="Es. Quante banane mangerà Marco stasera?"
              />
            </div>
            {options.map((opt, i) => (
              <div key={i}>
                <label htmlFor={`opt-${i}`}>Opzione {i + 1}</label>
                <InputText
                  id={`opt-${i}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  className="w-full mt-1"
                  placeholder={`Opzione ${i + 1}`}
                />
              </div>
            ))}
            {options.length < 4 && (
              <Button label="Aggiungi opzione" icon="pi pi-plus" text onClick={addOption} />
            )}
            <Button
              label="Inizia round"
              icon="pi pi-forward"
              onClick={handleStartRound}
              loading={loading}
            />
          </div>
        )}

        {room.status === 'betting' && room.currentRound && (
          <div className="flex flex-column gap-2 mt-3">
            <p>
              Round {room.roundNumber}: <strong>{room.currentRound.question}</strong>
            </p>
            <p className="text-500">
              Scommesse piazzate: {room.currentRound.bets.length} / {room.players.length}
            </p>

            {room.currentRound.status === 'open' && (
              <Button
                label="Chiudi scommesse"
                icon="pi pi-lock"
                severity="warning"
                onClick={handleCloseBetting}
                loading={loading}
              />
            )}

            {room.currentRound.status === 'closed' && (
              <div className="flex flex-column gap-2">
                <p className="text-yellow-400">Seleziona la risposta vincente:</p>
                {room.currentRound.options.map((opt, i) => (
                  <Button
                    key={i}
                    label={opt}
                    icon="pi pi-check"
                    severity="success"
                    outlined
                    onClick={() => handleReveal(i)}
                    loading={loading}
                  />
                ))}
              </div>
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
