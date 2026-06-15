'use client';

import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Toast } from 'primereact/toast';
import { useRef, useState } from 'react';
import { useGame, useCurrentPlayer } from '@/context/GameContext';
import { placeBet } from '@/lib/socket';

export function BettingPanel() {
  const { room, playerId } = useGame();
  const currentPlayer = useCurrentPlayer();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const toast = useRef<Toast>(null);

  if (!room?.currentRound) return null;
  if (room.status !== 'betting' && room.status !== 'revealed') return null;

  const round = room.currentRound;
  const myBet = round.bets.find((b) => b.playerId === playerId);
  const bettingOpen = round.status === 'open';
  const totalPot = round.bets.reduce((sum, b) => sum + b.amount, 0);

  const handlePlaceBet = async () => {
    if (selectedOption === null) {
      toast.current?.show({ severity: 'warn', summary: 'Seleziona un\'opzione' });
      return;
    }
    if (!betAmount || betAmount < 1) {
      toast.current?.show({ severity: 'warn', summary: 'Importo non valido' });
      return;
    }

    setLoading(true);
    const result = await placeBet(selectedOption, betAmount);
    setLoading(false);

    if (!result.success) {
      toast.current?.show({ severity: 'error', summary: 'Errore', detail: result.error });
      return;
    }

    toast.current?.show({
      severity: 'success',
      summary: 'Scommessa piazzata!',
      detail: `${betAmount} 🍌 su "${round.options[selectedOption]}"`,
    });
  };

  return (
    <>
      <Toast ref={toast} />
      <div className="player-card p-4 mb-3">
        <h3 className="mt-0">{round.question}</h3>

        {round.status === 'revealed' && round.winningOption !== null && (
          <p className="text-green-400 font-bold mb-3">
            Vincitore: {round.options[round.winningOption]}
          </p>
        )}

        <div className="flex flex-column gap-2 mb-3">
          {round.options.map((option, index) => {
            const betsOnOption = round.bets.filter((b) => b.optionIndex === index);
            const potOnOption = betsOnOption.reduce((s, b) => s + b.amount, 0);
            const isSelected = selectedOption === index;
            const isWinning =
              round.status === 'revealed' && round.winningOption === index;
            const isMyBet = myBet?.optionIndex === index;

            return (
              <Button
                key={index}
                label={`${option}${isMyBet ? ` (tu: ${myBet.amount} 🍌)` : ''}${potOnOption > 0 ? ` · ${potOnOption} 🍌` : ''}`}
                className={`option-button ${isSelected ? 'selected' : ''} ${isWinning ? 'winning-option' : ''}`}
                outlined={!isSelected && !isWinning}
                disabled={!bettingOpen || round.status !== 'open'}
                onClick={() => setSelectedOption(index)}
              />
            );
          })}
        </div>

        {bettingOpen && round.status === 'open' && (
          <div className="flex flex-column gap-3">
            <div className="flex align-items-center gap-2">
              <label htmlFor="bet-amount">Banane da scommettere</label>
              <span className="text-500 ml-auto">
                Disponibili: {currentPlayer?.bananas ?? 0} 🍌
              </span>
            </div>
            <InputNumber
              id="bet-amount"
              value={betAmount}
              onValueChange={(e) => setBetAmount(e.value ?? 1)}
              min={1}
              max={currentPlayer?.bananas ?? 100}
              showButtons
              className="w-full"
            />
            <Button
              label={myBet ? 'Aggiorna scommessa' : 'Piazza scommessa'}
              icon="pi pi-wallet"
              onClick={handlePlaceBet}
              loading={loading}
              disabled={!currentPlayer || currentPlayer.bananas < 1}
            />
          </div>
        )}

        {round.status === 'closed' && (
          <p className="text-yellow-400">
            <i className="pi pi-lock mr-2" />
            Scommesse chiuse. In attesa del risultato...
          </p>
        )}

        <p className="text-500 mt-3 mb-0">Piatto totale: {totalPot} 🍌</p>
      </div>
    </>
  );
}
