require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const {
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
} = require("./gameManager");
const { log, warn, error: logError } = require("./logger");

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN =
  process.env.CORS_ORIGIN ||
  "http://localhost:3000,https://racheleantonio.github.io";
const ROOM_SECRET = process.env.ROOM_SECRET || "dev-secret-change-me";

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);

const corsOptions = {
  origin:
    CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((o) => o.trim()),
  methods: ["GET", "POST"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`, {
      origin: req.headers.origin || "-",
      ip: req.ip,
    });
  });
  next();
});

const io = new Server(server, { cors: corsOptions });

const rooms = new Map();
const socketToRoom = new Map();

function broadcastRoomState(room) {
  io.to(room.id).emit("room:state", getPublicRoomState(room));
}

function validateRoomToken(roomId, token) {
  if (!ROOM_SECRET) return true;
  return token === `${roomId}-${ROOM_SECRET}`;
}

app.get("/", (_req, res) => {
  res.json({
    name: "Bet My Bananas API",
    status: "ok",
    rooms: rooms.size,
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

const SOCKET_AUTH_TOKEN = process.env.SOCKET_AUTH_TOKEN;

io.use((socket, next) => {
  if (SOCKET_AUTH_TOKEN) {
    const token = socket.handshake.auth?.token;
    if (token !== SOCKET_AUTH_TOKEN) {
      warn("Socket auth rejected", {
        socketId: socket.id,
        origin: socket.handshake.headers.origin,
      });
      return next(new Error("Invalid authentication token"));
    }
  }
  next();
});

io.on("connection", (socket) => {
  log("Socket connected", {
    socketId: socket.id,
    origin: socket.handshake.headers.origin,
    transport: socket.conn.transport.name,
  });

  socket.conn.on("upgrade", (transport) => {
    log("Socket transport upgraded", {
      socketId: socket.id,
      transport: transport.name,
    });
  });

  socket.on("room:create", ({ name }, callback) => {
    try {
      const room = createRoom(rooms, socket.id, name.trim());
      socket.join(room.id);
      socketToRoom.set(socket.id, room.id);

      log("Room created", {
        roomId: room.id,
        organizer: name.trim(),
        socketId: socket.id,
      });
      callback?.({
        success: true,
        room: getPublicRoomState(room),
        playerId: room.players[socket.id].id,
      });
      broadcastRoomState(room);
    } catch (err) {
      logError("room:create failed", {
        socketId: socket.id,
        error: err.message,
      });
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("room:join", ({ roomId, name, playerId }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        warn("room:join failed - room not found", {
          roomId,
          name,
          socketId: socket.id,
        });
        callback?.({ success: false, error: "Room not found" });
        return;
      }

      if (playerId) {
        const player = reconnectPlayer(room, socket.id, playerId);
        if (!player) {
          warn("room:join failed - player not found", {
            roomId,
            playerId,
            socketId: socket.id,
          });
          callback?.({ success: false, error: "Player not found" });
          return;
        }
        log("Player reconnected", {
          roomId,
          playerId,
          name: player.name,
          socketId: socket.id,
        });
      } else {
        const result = joinRoom(rooms, roomId, socket.id, name.trim());
        if (result.error) {
          warn("room:join failed", {
            roomId,
            name,
            error: result.error,
            socketId: socket.id,
          });
          callback?.({ success: false, error: result.error });
          return;
        }
        log("Player joined", {
          roomId,
          name: name.trim(),
          socketId: socket.id,
        });
      }

      socket.join(roomId);
      socketToRoom.set(socket.id, roomId);

      const player = room.players[socket.id];
      callback?.({
        success: true,
        room: getPublicRoomState(room),
        playerId: player.id,
      });
      broadcastRoomState(room);
    } catch (err) {
      logError("room:join error", {
        roomId,
        error: err.message,
        socketId: socket.id,
      });
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("game:start", (_payload, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      warn("game:start - not in room", { socketId: socket.id });
      callback?.({ success: false, error: "Not in a room" });
      return;
    }

    const result = startGame(room, socket.id);
    if (result.error) {
      warn("game:start failed", { roomId: room.id, error: result.error });
      callback?.({ success: false, error: result.error });
      return;
    }

    log("Game started", {
      roomId: room.id,
      players: Object.keys(room.players).length,
    });

    callback?.({ success: true });
    broadcastRoomState(room);
  });

  socket.on("round:start", (_payload, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: "Not in a room" });
      return;
    }

    const result = startRound(room, socket.id);
    if (result.error) {
      callback?.({ success: false, error: result.error });
      return;
    }

    log("Round started", { roomId: room.id, roundNumber: room.roundNumber });
    callback?.({ success: true });
    io.to(room.id).emit("round:started", { roundNumber: room.roundNumber });
    broadcastRoomState(room);
  });

  socket.on("bet:place", ({ amount }, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: "Not in a room" });
      return;
    }

    const result = placeBet(room, socket.id, { amount });
    if (result.error) {
      warn("bet:place failed", {
        roomId: room.id,
        amount,
        error: result.error,
      });
      callback?.({ success: false, error: result.error });
      return;
    }

    log("Bet placed", { roomId: room.id, amount, playerId: result.player.id });
    callback?.({ success: true, bananas: result.player.bananas });
    broadcastRoomState(room);
  });

  socket.on("round:end", (_payload, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: "Not in a room" });
      return;
    }

    const result = endRound(room, socket.id);
    if (result.error) {
      warn("round:end failed", { roomId: room.id, error: result.error });
      callback?.({ success: false, error: result.error });
      return;
    }

    log("Round ended", {
      roomId: room.id,
      roundNumber: room.roundNumber,
      winnerId: result.winnerId,
      winningBet: result.winningBet,
      secondHighestBet: result.secondHighestBet,
      winnerPayout: result.winnerPayout,
      bankIncrease: result.bankIncrease,
      bankTotal: room.bank,
    });

    callback?.({ success: true });
    io.to(room.id).emit("round:revealed", {
      winnerId: result.winnerId,
      winningBet: result.winningBet,
      secondHighestBet: result.secondHighestBet,
      winnerPayout: result.winnerPayout,
      bankIncrease: result.bankIncrease,
    });
    broadcastRoomState(room);
  });

  socket.on("game:end", (_payload, callback) => {
    const room = findRoomBySocketId(rooms, socket.id);
    if (!room) {
      callback?.({ success: false, error: "Not in a room" });
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

  socket.on("disconnect", (reason) => {
    const roomId = socketToRoom.get(socket.id);
    log("Socket disconnected", {
      socketId: socket.id,
      roomId: roomId || "-",
      reason,
    });

    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const result = removePlayerFromRoom(room, socket.id);
    socketToRoom.delete(socket.id);

    if (result.organizerLeft) {
      io.to(roomId).emit("organizer:disconnected");
      broadcastRoomState(room);
      return;
    }

    if (Object.keys(room.players).length === 0) {
      log("Room deleted (empty)", { roomId });
      rooms.delete(roomId);
      return;
    }

    broadcastRoomState(room);
  });
});

setInterval(
  () => {
    const maxAge = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const [id, room] of rooms.entries()) {
      if (now - room.createdAt > maxAge && room.status === "lobby") {
        rooms.delete(id);
      }
    }
  },
  60 * 60 * 1000,
);

server.listen(PORT, "0.0.0.0", () => {
  log("Bet My Bananas server started", {
    port: PORT,
    corsOrigin: CORS_ORIGIN,
    authEnabled: Boolean(SOCKET_AUTH_TOKEN),
    nodeEnv: process.env.NODE_ENV || "development",
  });
});
