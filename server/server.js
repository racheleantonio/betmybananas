require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const {
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
} = require('./gameManager');

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const ROOM_SECRET = process.env.ROOM_SECRET || 'dev-secret-change-me';

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, { cors: corsOptions });

const rooms = new Map();
const socketToRoom = new Map();

function broadcastRoomState(room) {
  io.to(room.id).emit('room:state', getPublicRoomState(room));
}

function validateRoomToken(roomId, token) {
  if (!ROOM_SECRET) return true;
  return token === `${roomId}-${ROOM_SECRET}`;
}

app.get('/', (_req, res) => {
  res.json({
    name: 'Bet My Bananas API',
    status: 'ok',
    rooms: rooms.size,
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

const SOCKET_AUTH_TOKEN = process.env.SOCKET_AUTH_TOKEN;

io.use((socket, next) => {
  if (SOCKET_AUTH_TOKEN) {
    const token = socket.handshake.auth?.token;
    if (token !== SOCKET_AUTH_TOKEN) {
      return next(new Error('Invalid authentication token'));
    }
  }
  next();
});

io.on('connection', (socket) => {
  socket.on('room:create', ({ name }, callback) => {
    try {
      const room = createRoom(rooms, socket.id, name.trim());
      socket.join(room.id);
      socketToRoom.set(socket.id, room.id);

      callback?.({ success: true, room: getPublicRoomState(room), playerId: room.players[socket.id].id });
      broadcastRoomState(room);
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on('room:join', ({ roomId, name, playerId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        callback?.({ success: false, error: 'Room not found' });
        return;
      }

      if (playerId) {
        const player = reconnectPlayer(room, socket.id, playerId);
        if (!player) {
          callback?.({ success: false, error: 'Player not found' });
          return;
        }
      } else {
        const result = joinRoom(rooms, roomId, socket.id, name.trim());
        if (result.error) {
          callback?.({ success: false, error: result.error });
          return;
        }
      }

      socket.join(roomId);
      socketToRoom.set(socket.id, roomId);

      const player = room.players[socket.id];
      callback?.({ success: true, room: getPublicRoomState(room), playerId: player.id });
      broadcastRoomState(room);
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on('game:start', (_payload, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: 'Not in a room' });
      return;
    }

    const result = startGame(room, socket.id);
    if (result.error) {
      callback?.({ success: false, error: result.error });
      return;
    }

    callback?.({ success: true });
    broadcastRoomState(room);
  });

  socket.on('round:start', ({ question, options }, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: 'Not in a room' });
      return;
    }

    const result = startRound(room, socket.id, { question, options });
    if (result.error) {
      callback?.({ success: false, error: result.error });
      return;
    }

    callback?.({ success: true });
    io.to(room.id).emit('round:started', { roundNumber: room.roundNumber });
    broadcastRoomState(room);
  });

  socket.on('bet:place', ({ optionIndex, amount }, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: 'Not in a room' });
      return;
    }

    const result = placeBet(room, socket.id, { optionIndex, amount });
    if (result.error) {
      callback?.({ success: false, error: result.error });
      return;
    }

    callback?.({ success: true, bananas: result.player.bananas });
    broadcastRoomState(room);
  });

  socket.on('betting:close', (_payload, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: 'Not in a room' });
      return;
    }

    const result = closeBetting(room, socket.id);
    if (result.error) {
      callback?.({ success: false, error: result.error });
      return;
    }

    callback?.({ success: true });
    broadcastRoomState(room);
  });

  socket.on('round:reveal', ({ winningOption }, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: 'Not in a room' });
      return;
    }

    const result = revealWinner(room, socket.id, { winningOption });
    if (result.error) {
      callback?.({ success: false, error: result.error });
      return;
    }

    callback?.({ success: true });
    io.to(room.id).emit('round:revealed', {
      winningOption,
      payouts: result.payouts,
      totalPot: result.totalPot,
    });
    broadcastRoomState(room);
  });

  socket.on('game:end', (_payload, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: 'Not in a room' });
      return;
    }

    const result = endGame(room, socket.id);
    if (result.error) {
      callback?.({ success: false, error: result.error });
      return;
    }

    callback?.({ success: true });
    broadcastRoomState(room);
  });

  socket.on('disconnect', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const result = removePlayerFromRoom(room, socket.id);
    socketToRoom.delete(socket.id);

    if (result.organizerLeft) {
      io.to(roomId).emit('organizer:disconnected');
      broadcastRoomState(room);
      return;
    }

    if (Object.keys(room.players).length === 0) {
      rooms.delete(roomId);
      return;
    }

    broadcastRoomState(room);
  });
});

setInterval(() => {
  const maxAge = 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > maxAge && room.status === 'lobby') {
      rooms.delete(id);
    }
  }
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Bet My Bananas server running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});
