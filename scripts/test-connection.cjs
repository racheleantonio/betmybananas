const { io } = require('../client/node_modules/socket.io-client/build/cjs/index.js');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

function fail(message, error) {
  console.error(`FAIL: ${message}`);
  if (error) console.error(error);
  process.exit(1);
}

async function testHealth() {
  const response = await fetch(`${SOCKET_URL}/health`);
  if (!response.ok) fail(`Health check HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== 'healthy') fail('Health check body invalid', body);
  console.log('OK: GET /health', body);
}

function testSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      transports: ['polling'],
      upgrade: false,
      timeout: 10000,
      auth: { token: 'dev' },
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Socket connection timed out'));
    }, 10000);

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });

    socket.on('connect', () => {
      console.log('OK: Socket connected', {
        id: socket.id,
        transport: socket.io.engine.transport.name,
      });

      socket.emit('room:create', { name: 'LocalTest' }, (response) => {
        clearTimeout(timer);
        if (!response?.success) {
          socket.close();
          reject(new Error(response?.error || 'room:create failed'));
          return;
        }

        console.log('OK: room:create', {
          roomId: response.room?.id,
          playerId: response.playerId,
          players: response.room?.players?.length,
        });

        socket.close();
        resolve();
      });
    });
  });
}

(async () => {
  try {
    await testHealth();
    await testSocket();
    console.log('All local client-server checks passed.');
  } catch (error) {
    fail('Client-server connection test failed', error);
  }
})();
