'use client';

import { Card } from 'primereact/card';
import { useGame } from '@/context/GameContext';

export function RoundHistory() {
  const { room } = useGame();
  if (!room?.history.length) return null;

  return (
    <Card title="Storico round" className="player-card mt-3">
      <ul className="list-none p-0 m-0">
        {[...room.history].reverse().map((round) => (
          <li key={round.roundNumber} className="py-2 border-bottom-1 border-800">
            <div className="font-bold">Round {round.roundNumber}</div>
            <div className="text-500 text-sm">{round.question}</div>
            <div className="text-green-400 text-sm mt-1">
              ✓ {round.options[round.winningOption]} · Piatto: {round.totalPot} 🍌
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
