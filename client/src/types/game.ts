export interface Player {
  id: string;
  name: string;
  bananas: number;
  isOrganizer: boolean;
  connected: boolean;
  eliminated: boolean;
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
  secondPlaceId: string | null;
  winnerPayout: number | null;
  newBankTotal: number | null;
}

export interface RoundHistory {
  roundNumber: number;
  bets: Bet[];
  winnerId: string;
  secondPlaceId: string | null;
  winningBet: number;
  secondHighestBet: number;
  winnerPayout: number;
  delta: number;
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
