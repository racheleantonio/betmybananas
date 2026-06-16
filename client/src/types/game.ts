export interface Player {
  id: string;
  name: string;
  bananas: number;
  isOrganizer: boolean;
  connected: boolean;
}

export interface Bet {
  playerId: string;
  amount: number;
}

export interface CurrentRound {
  status: 'open' | 'revealed';
  bets: Bet[];
  winnerId: string | null;
  winningBet: number | null;
  secondHighestBet: number | null;
  winnerPayout: number | null;
  bankIncrease: number | null;
}

export interface RoundHistory {
  roundNumber: number;
  bets: Bet[];
  winnerId: string;
  winningBet: number;
  secondHighestBet: number;
  winnerPayout: number;
  bankIncrease: number;
  bankTotal: number;
}

export interface RoomState {
  id: string;
  status: 'lobby' | 'playing' | 'betting' | 'revealed' | 'finished';
  roundNumber: number;
  bank: number;
  players: Player[];
  currentRound: CurrentRound | null;
  history: RoundHistory[];
}

export interface SocketResponse {
  success: boolean;
  error?: string;
  room?: RoomState;
  playerId?: string;
  bananas?: number;
}
