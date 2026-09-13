const http = require('node:http');
const assert = require('node:assert');
const { io: ioClient } = require('socket.io-client');

// Start server process or test against server.js
const { spawn } = require('node:child_process');

console.log('Iniciando servidor para prueba de integración...');
const serverProcess = spawn('node', ['server/server.js'], {
  env: { ...process.env, PORT: '3005' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
serverProcess.stdout.on('data', (d) => { serverOutput += d.toString(); });
serverProcess.stderr.on('data', (d) => { console.error('Server err:', d.toString()); });

setTimeout(async () => {
  try {
    console.log('Probando endpoint HTTP GET /api/rooms...');
    const res = await fetch('http://127.0.0.1:3005/api/rooms');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.rooms.length, 14);
    console.log('✅ API REST responde correctamente con las 14 habitaciones');

    console.log('Conectando 2 clientes Socket.IO...');
    const client1 = ioClient('http://127.0.0.1:3005');
    const client2 = ioClient('http://127.0.0.1:3005');

    await Promise.all([
      new Promise(res => client1.on('connect', res)),
      new Promise(res => client2.on('connect', res))
    ]);
    console.log('✅ Ambos clientes conectados vía WebSocket');

    // Test: Cliente 1 emite cambio a SUCIA en habitación 7, Cliente 2 debe recibirlo
    const updatePromise = new Promise((resolve) => {
      client2.on('room:updated', (room) => {
        if (room.id === 7 && room.estado === 'SUCIA') {
          resolve(room);
        }
      });
    });

    client1.emit('room:update', { id: 7, estado: 'SUCIA' });
    const receivedRoom = await updatePromise;
    assert.strictEqual(receivedRoom.id, 7);
    assert.strictEqual(receivedRoom.estado, 'SUCIA');
    assert.strictEqual(receivedRoom.hora_salida, null);
    console.log('✅ Cliente 2 recibió en tiempo real: Habitación 7 -> SUCIA');

    // Test 2: Cliente 2 emite cambio a OCUPADA en habitación 8 con hora 14:00, Cliente 1 debe recibirlo
    const updatePromise2 = new Promise((resolve) => {
      client1.on('room:updated', (room) => {
        if (room.id === 8 && room.estado === 'OCUPADA' && room.hora_salida === '14:00') {
          resolve(room);
        }
      });
    });

    client2.emit('room:update', { id: 8, estado: 'OCUPADA', hora_salida: '14:00' });
    const receivedRoom2 = await updatePromise2;
    assert.strictEqual(receivedRoom2.id, 8);
    assert.strictEqual(receivedRoom2.estado, 'OCUPADA');
    assert.strictEqual(receivedRoom2.hora_salida, '14:00');
    console.log('✅ Cliente 1 recibió en tiempo real: Habitación 8 -> OCUPADA (14:00)');

    client1.disconnect();
    client2.disconnect();

    serverProcess.kill('SIGTERM');
    console.log('\n🎉 PRUEBA DE TIEMPO REAL Y WEBSOCKETS SUPERADA EXITOSAMENTE');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en prueba de integración:', err);
    serverProcess.kill('SIGKILL');
    process.exit(1);
  }
}, 1500);

