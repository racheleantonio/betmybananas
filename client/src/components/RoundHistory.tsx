'use client';

import { Card } from 'primereact/card';
import { useGame } from '@/context/GameContext';

export function RoundHistory() {
  const { room } = useGame();
  if (!room?.history.length) return null;

  return (
    <Card title="Storico round" className="player-card mt-3">
      <ul className="list-none p-0 m-0">
        {[...room.history].reverse().map((round) => {
          const winner = room.players.find((p) => p.id === round.winnerId);
          const secondPlace = room.players.find(
            (p) => p.id === round.secondPlaceId
          );
          return (
            <li
              key={round.roundNumber}
              className="py-2 border-bottom-1 border-800"
            >
              <div className="font-bold">Round {round.roundNumber}</div>
              <div className="text-green-400 text-sm mt-1">
                ✓ {winner?.name || 'Vincitore'} · puntata {round.winningBet} 🍌
              </div>
              <div className="text-500 text-sm">
                Bilancio vincitore: {round.winnerPayout >= 0 ? '+' : ''}
                {round.winnerPayout} 🍌
              </div>
              {secondPlace && (
                <div className="text-500 text-sm">
                  {secondPlace.name} (2° posto): +{round.delta} 🍌
                </div>
              )}
              <div className="text-500 text-sm">
                Banca ora: {round.bankTotal} 🍌
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
