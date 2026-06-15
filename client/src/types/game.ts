export interface Player {
  id: string;
  name: string;
  bananas: number;
  isOrganizer: boolean;
  connected: boolean;
}

export interface Bet {
  playerId: string;
  optionIndex: number;
  amount: number;
}

export interface CurrentRound {
  question: string;
  options: string[];
  status: 'open' | 'closed' | 'revealed';
  bets: Bet[];
  winningOption: number | null;
}

export interface RoundHistory {
  roundNumber: number;
  question: string;
  options: string[];
  winningOption: number;
  totalPot: number;
  payouts: Record<string, number>;
}

export interface RoomState {
  id: string;
  status: 'lobby' | 'playing' | 'betting' | 'revealed' | 'finished';
  roundNumber: number;
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
