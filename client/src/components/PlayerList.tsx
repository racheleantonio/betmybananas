'use client';

import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import type { Player } from '@/types/game';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string | null;
  showBananas?: boolean;
}

export function PlayerList({ players, currentPlayerId, showBananas = true }: PlayerListProps) {
  const sorted = [...players].sort((a, b) => b.bananas - a.bananas);

  return (
    <Card title="Giocatori" className="player-card">
      <ul className="list-none p-0 m-0">
        {sorted.map((player, index) => (
          <li
            key={player.id}
            className="flex align-items-center justify-content-between py-2 border-bottom-1 border-800"
          >
            <div className="flex align-items-center gap-2">
              <span className="text-500 font-bold w-2rem">{index + 1}.</span>
              <span className={player.id === currentPlayerId ? 'text-yellow-400 font-bold' : ''}>
                {player.name}
                {player.id === currentPlayerId && ' (tu)'}
              </span>
              {player.isOrganizer && <Tag value="Organizer" severity="warning" />}
              {!player.connected && <Tag value="Offline" severity="danger" />}
            </div>
            {showBananas && (
              <span className="score-badge">🍌 {player.bananas}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
