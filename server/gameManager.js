const { v4: uuidv4 } = require('uuid');

const STARTING_BANANAS = 10;
const BANK_START = 10;
const MIN_BET = 1;

function createEmptyRoom(roomId, organizerSocketId, organizerName) {
  const organizerId = uuidv4();
  return {
    id: roomId,
    organizerId,
    organizerSocketId,
    bank: BANK_START,
    players: {
      [organizerSocketId]: {
        id: organizerId,
        name: organizerName,
        bananas: STARTING_BANANAS,
        socketId: organizerSocketId,
        isOrganizer: true,
        eliminated: false,
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
    eliminated: Boolean(p.eliminated),
  }));

  let currentRound = null;
  if (room.currentRound) {
    const bets = Object.entries(room.currentRound.bets).map(
      ([playerId, bet]) => ({ playerId, amount: bet.amount })
    );

    currentRound = {
      status: room.currentRound.status,
      bets,
      winnerId:
        room.currentRound.status === 'revealed'
          ? room.currentRound.winnerId
          : null,
      winningBet:
        room.currentRound.status === 'revealed'
          ? room.currentRound.winningBet
          : null,
      secondHighestBet:
        room.currentRound.status === 'revealed'
          ? room.currentRound.secondHighestBet
          : null,
      secondPlaceId:
        room.currentRound.status === 'revealed'
          ? room.currentRound.secondPlaceId
          : null,
      winnerPayout:
        room.currentRound.status === 'revealed'
          ? room.currentRound.winnerPayout
          : null,
      newBankTotal:
        room.currentRound.status === 'revealed'
          ? room.currentRound.newBankTotal
          : null,
    };
  }

  return {
    id: room.id,
    status: room.status,
    roundNumber: room.roundNumber,
    bank: room.bank || 0,
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
    (p) =>
      p.name.toLowerCase() === playerName.toLowerCase() &&
      p.socketId !== socketId
  );
  if (nameTaken) return { error: 'Name already taken' };

  const existing = Object.values(room.players).find(
    (p) => p.socketId === socketId
  );
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
    eliminated: false,
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
  if (room.organizerSocketId !== socketId)
    return { error: 'Only the organizer can start the game' };
  if (room.status !== 'lobby') return { error: 'Game already started' };
  if (Object.keys(room.players).length < 2)
    return { error: 'Need at least 2 players' };

  room.status = 'playing';
  return { room };
}

function startRound(room, socketId) {
  if (room.organizerSocketId !== socketId)
    return { error: 'Only the organizer can start a round' };
  if (room.status !== 'playing' && room.status !== 'revealed') {
    return { error: 'Game is not active' };
  }

  room.roundNumber += 1;
  room.status = 'betting';
  room.currentRound = {
    bets: {},
    status: 'open',
    winnerId: null,
    winningBet: null,
    secondHighestBet: null,
    secondPlaceId: null,
    winnerPayout: null,
    newBankTotal: null,
  };

  return { room };
}

function placeBet(room, socketId, { amount }) {
  if (
    room.status !== 'betting' ||
    !room.currentRound ||
    room.currentRound.status !== 'open'
  ) {
    return { error: 'Betting is closed' };
  }

  const player = room.players[socketId];
  if (!player) return { error: 'Player not found' };
  if (player.eliminated)
    return { error: 'You have been eliminated from this game' };
  const betAmount = Number(amount);
  if (!Number.isInteger(betAmount) || betAmount < 1) {
    return { error: 'Bet must be a positive whole number' };
  }

  // Don't deduct bananas here — doing so would change the live scoreboard
  // mid-round and leak the bet amount to everyone watching. Bananas are
  // deducted once, in endRound, after betting closes.
  room.currentRound.bets[player.id] = { amount: betAmount };

  return { room, player };
}

function getSecondHighestBetValue(bets) {
  const uniqueAmounts = [...new Set(bets.map((bet) => bet.amount))].sort(
    (a, b) => b - a
  );
  return uniqueAmounts.length >= 2 ? uniqueAmounts[1] : 0;
}

function pickWinner(bets) {
  const highestAmount = Math.max(...bets.map((bet) => bet.amount));
  const topBets = bets.filter((bet) => bet.amount === highestAmount);
  topBets.sort((a, b) => a.playerId.localeCompare(b.playerId));
  return topBets[0];
}

function pickBetByAmount(bets, amount) {
  const matching = bets.filter((bet) => bet.amount === amount);
  matching.sort((a, b) => a.playerId.localeCompare(b.playerId));
  return matching[0];
}

function endRound(room, socketId) {
  if (room.organizerSocketId !== socketId)
    return { error: 'Only the organizer can end the round' };
  if (!room.currentRound || room.currentRound.status !== 'open') {
    return { error: 'No open betting round' };
  }

  const bets = Object.entries(room.currentRound.bets).map(
    ([playerId, bet]) => ({
      playerId,
      amount: bet.amount,
    })
  );

  if (bets.length < 2) {
    return { error: 'Need at least 2 bets before ending the round' };
  }

  const winner = pickWinner(bets);
  const winningBet = winner.amount;
  const secondHighestBet = getSecondHighestBetValue(bets);
  const delta = winningBet - secondHighestBet;
  const bankBeforeRound = room.bank || 0;

  // Winner takes the current bank minus the delta — this can go negative
  // if their bid was way higher than the second-highest bid relative to
  // what's in the bank.
  const winnerPayout = bankBeforeRound - delta;

  const winnerPlayer = Object.values(room.players).find(
    (p) => p.id === winner.playerId
  );
  if (winnerPlayer) {
    winnerPlayer.bananas += winnerPayout;
    if (winnerPlayer.bananas < 0 && !winnerPlayer.eliminated) {
      winnerPlayer.eliminated = true;
    }
  }

  // Second place always receives the delta, regardless of the winner's outcome.
  const secondPlaceBet = pickBetByAmount(bets, secondHighestBet);
  if (secondPlaceBet) {
    const secondPlacePlayer = Object.values(room.players).find(
      (p) => p.id === secondPlaceBet.playerId
    );
    if (secondPlacePlayer) {
      secondPlacePlayer.bananas += delta;
    }
  }

  // The bank becomes this round's winning bid, ready for next round.
  room.bank = winningBet;

  room.currentRound.status = 'revealed';
  room.currentRound.winnerId = winner.playerId;
  room.currentRound.winningBet = winningBet;
  room.currentRound.secondHighestBet = secondHighestBet;
  room.currentRound.winnerPayout = winnerPayout;
  room.currentRound.newBankTotal = room.bank;
  room.status = 'revealed';

  room.history.push({
    roundNumber: room.roundNumber,
    bets: bets.map((bet) => ({ ...bet })),
    winnerId: winner.playerId,
    secondPlaceId: secondPlaceBet.playerId,
    winningBet,
    secondHighestBet,
    winnerPayout,
    delta,
    bankTotal: room.bank,
  });

  return {
    room,
    winnerId: winner.playerId,
    winningBet,
    secondHighestBet,
    winnerPayout,
    newBankTotal: room.bank,
  };
}

function endGame(room, socketId) {
  if (room.organizerSocketId !== socketId)
    return { error: 'Only the organizer can end the game' };
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
    if (Object.values(room.players).some((p) => p.socketId === socketId))
      return room;
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
  endRound,
  endGame,
  removePlayerFromRoom,
  findRoomBySocketId,
  getPublicRoomState,
  STARTING_BANANAS,
};
