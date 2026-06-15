const { v4: uuidv4 } = require('uuid');

const STARTING_BANANAS = 100;
const MIN_BET = 1;
const MAX_BET = 100;

function createEmptyRoom(roomId, organizerSocketId, organizerName) {
  const organizerId = uuidv4();
  return {
    id: roomId,
    organizerId,
    organizerSocketId,
    players: {
      [organizerSocketId]: {
        id: organizerId,
        name: organizerName,
        bananas: STARTING_BANANAS,
        socketId: organizerSocketId,
        isOrganizer: true,
      },
    },
    status: 'lobby',
    currentRound: null,
    roundNumber: 0,
    history: [],
    createdAt: Date.now(),
  };
}

function getPublicRoomState(room) {
  const players = Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    bananas: p.bananas,
    isOrganizer: p.isOrganizer,
    connected: Boolean(p.socketId),
  }));

  let currentRound = null;
  if (room.currentRound) {
    const bets = Object.entries(room.currentRound.bets).map(([playerId, bet]) => ({
      playerId,
      optionIndex: bet.optionIndex,
      amount: bet.amount,
    }));

    currentRound = {
      question: room.currentRound.question,
      options: room.currentRound.options,
      status: room.currentRound.status,
      bets,
      winningOption: room.currentRound.status === 'revealed' ? room.currentRound.winningOption : null,
    };
  }

  return {
    id: room.id,
    status: room.status,
    roundNumber: room.roundNumber,
    players,
    currentRound,
    history: room.history,
  };
}

function createRoom(rooms, organizerSocketId, organizerName) {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const room = createEmptyRoom(roomId, organizerSocketId, organizerName);
  rooms.set(roomId, room);
  return room;
}

function joinRoom(rooms, roomId, socketId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'lobby') return { error: 'Game already started' };

  const nameTaken = Object.values(room.players).some(
    (p) => p.name.toLowerCase() === playerName.toLowerCase() && p.socketId !== socketId
  );
  if (nameTaken) return { error: 'Name already taken' };

  const existing = Object.values(room.players).find((p) => p.socketId === socketId);
  if (existing) {
    existing.name = playerName;
    return { room, player: existing };
  }

  const player = {
    id: uuidv4(),
    name: playerName,
    bananas: STARTING_BANANAS,
    socketId,
    isOrganizer: false,
  };
  room.players[socketId] = player;
  return { room, player };
}

function reconnectPlayer(room, socketId, playerId) {
  const player = Object.values(room.players).find((p) => p.id === playerId);
  if (!player) return null;

  if (player.socketId && player.socketId !== socketId) {
    delete room.players[player.socketId];
  }
  player.socketId = socketId;
  if (player.isOrganizer) {
    room.organizerSocketId = socketId;
  }
  return player;
}

function startGame(room, socketId) {
  if (room.organizerSocketId !== socketId) return { error: 'Only the organizer can start the game' };
  if (room.status !== 'lobby') return { error: 'Game already started' };
  if (Object.keys(room.players).length < 2) return { error: 'Need at least 2 players' };

  room.status = 'playing';
  return { room };
}

function startRound(room, socketId, { question, options }) {
  if (room.organizerSocketId !== socketId) return { error: 'Only the organizer can start a round' };
  if (room.status !== 'playing' && room.status !== 'betting' && room.status !== 'revealed') {
    return { error: 'Game is not active' };
  }
  if (!question || !options || options.length < 2 || options.length > 4) {
    return { error: 'Provide a question and 2-4 options' };
  }

  const trimmedOptions = options.map((o) => String(o).trim()).filter(Boolean);
  if (trimmedOptions.length < 2) return { error: 'Provide at least 2 valid options' };

  room.roundNumber += 1;
  room.status = 'betting';
  room.currentRound = {
    question: String(question).trim(),
    options: trimmedOptions,
    bets: {},
    status: 'open',
    winningOption: null,
  };

  return { room };
}

function placeBet(room, socketId, { optionIndex, amount }) {
  if (room.status !== 'betting' || !room.currentRound || room.currentRound.status !== 'open') {
    return { error: 'Betting is closed' };
  }

  const player = room.players[socketId];
  if (!player) return { error: 'Player not found' };

  const betAmount = Number(amount);
  if (!Number.isInteger(betAmount) || betAmount < MIN_BET || betAmount > MAX_BET) {
    return { error: `Bet must be between ${MIN_BET} and ${MAX_BET}` };
  }
  if (betAmount > player.bananas) return { error: 'Not enough bananas' };

  const idx = Number(optionIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= room.currentRound.options.length) {
    return { error: 'Invalid option' };
  }

  const existingBet = room.currentRound.bets[player.id];
  if (existingBet) {
    player.bananas += existingBet.amount;
  }

  player.bananas -= betAmount;
  room.currentRound.bets[player.id] = { optionIndex: idx, amount: betAmount };

  return { room, player };
}

function closeBetting(room, socketId) {
  if (room.organizerSocketId !== socketId) return { error: 'Only the organizer can close betting' };
  if (!room.currentRound || room.currentRound.status !== 'open') {
    return { error: 'No open betting round' };
  }

  room.currentRound.status = 'closed';
  room.status = 'betting';
  return { room };
}

function revealWinner(room, socketId, { winningOption }) {
  if (room.organizerSocketId !== socketId) return { error: 'Only the organizer can reveal the winner' };
  if (!room.currentRound || room.currentRound.status === 'revealed') {
    return { error: 'No round to reveal' };
  }

  const idx = Number(winningOption);
  if (!Number.isInteger(idx) || idx < 0 || idx >= room.currentRound.options.length) {
    return { error: 'Invalid winning option' };
  }

  room.currentRound.status = 'revealed';
  room.currentRound.winningOption = idx;
  room.status = 'revealed';

  const winningBets = Object.entries(room.currentRound.bets).filter(
    ([, bet]) => bet.optionIndex === idx
  );

  const totalPot = Object.values(room.currentRound.bets).reduce((sum, b) => sum + b.amount, 0);
  const winningPot = winningBets.reduce((sum, [, b]) => sum + b.amount, 0);

  const payouts = {};

  if (winningPot > 0) {
    for (const [playerId, bet] of winningBets) {
      const share = (bet.amount / winningPot) * totalPot;
      const player = Object.values(room.players).find((p) => p.id === playerId);
      if (player) {
        player.bananas += Math.floor(share);
        payouts[playerId] = Math.floor(share);
      }
    }
  }

  room.history.push({
    roundNumber: room.roundNumber,
    question: room.currentRound.question,
    options: room.currentRound.options,
    winningOption: idx,
    totalPot,
    payouts,
  });

  return { room, payouts, totalPot, winningPot };
}

function endGame(room, socketId) {
  if (room.organizerSocketId !== socketId) return { error: 'Only the organizer can end the game' };
  room.status = 'finished';
  room.currentRound = null;
  return { room };
}

function removePlayerFromRoom(room, socketId) {
  const player = room.players[socketId];
  if (!player) return null;

  if (player.isOrganizer) {
    player.socketId = null;
    return { room, disconnected: player, organizerLeft: true };
  }

  delete room.players[socketId];
  return { room, disconnected: player, organizerLeft: false };
}

function findRoomBySocketId(rooms, socketId) {
  for (const room of rooms.values()) {
    if (room.players[socketId]) return room;
    if (Object.values(room.players).some((p) => p.socketId === socketId)) return room;
  }
  return null;
}

module.exports = {
  createRoom,
  joinRoom,
  reconnectPlayer,
  startGame,
  startRound,
  placeBet,
  closeBetting,
  revealWinner,
  endGame,
  removePlayerFromRoom,
  findRoomBySocketId,
  getPublicRoomState,
  STARTING_BANANAS,
};
