const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { io: ioClient } = require('socket.io-client');

console.log('--- TEST 9: Sincronización en tiempo real Socket.IO con salida_at ---');

const server = spawn('node', ['server/server.js'], {
  env: { ...process.env, PORT: '3008' },
  stdio: ['ignore', 'pipe', 'pipe']
});

setTimeout(async () => {
  try {
    const c1 = ioClient('http://127.0.0.1:3008');
    const c2 = ioClient('http://127.0.0.1:3008');

    await Promise.all([
      new Promise(res => c1.on('connect', res)),
      new Promise(res => c2.on('connect', res))
    ]);
    console.log('✅ Clientes 1 y 2 conectados por WebSocket');

    const expectedTs = Date.now() + 7200000; // 2 horas adelante

    // Cliente 1 emite cambio a OCUPADA con hora_salida y salida_at
    const updatePromise = new Promise(resolve => {
      c2.on('room:updated', (room) => {
        if (room.id === 6 && room.estado === 'OCUPADA') {
          resolve(room);
        }
      });
    });

    c1.emit('room:update', {
      id: 6,
      estado: 'OCUPADA',
      hora_salida: '16:00',
      salida_at: expectedTs
    });

    const received = await updatePromise;
    assert.strictEqual(received.id, 6);
    assert.strictEqual(received.estado, 'OCUPADA');
    assert.strictEqual(received.hora_salida, '16:00');
    assert.strictEqual(received.salida_at, expectedTs);
    console.log('✅ Cliente 2 recibió en tiempo real salida_at y hora_salida idénticos');

    // Cliente 2 emite cambio a SUCIA -> Cliente 1 debe recibir hora_salida: null y salida_at: null
    const clearPromise = new Promise(resolve => {
      c1.on('room:updated', (room) => {
        if (room.id === 6 && room.estado === 'SUCIA') {
          resolve(room);
        }
      });
    });

    c2.emit('room:update', {
      id: 6,
      estado: 'SUCIA',
      hora_salida: null,
      salida_at: null
    });

    const receivedCleared = await clearPromise;
    assert.strictEqual(receivedCleared.id, 6);
    assert.strictEqual(receivedCleared.estado, 'SUCIA');
    assert.strictEqual(receivedCleared.hora_salida, null);
    assert.strictEqual(receivedCleared.salida_at, null);
    console.log('✅ Cliente 1 recibió en tiempo real limpieza de hora_salida y salida_at al pasar a SUCIA');

    c1.disconnect();
    c2.disconnect();
    server.kill('SIGTERM');

    console.log('\n🎉 CASO 9 SUPERADO EXITOSAMENTE: Sincronización en tiempo real perfecta');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en Test 9:', err);
    server.kill('SIGKILL');
    process.exit(1);
  }
}, 1500);
