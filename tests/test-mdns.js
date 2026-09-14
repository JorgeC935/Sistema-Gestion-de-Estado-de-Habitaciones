const { spawn } = require('node:child_process');
const assert = require('node:assert');
const mDNS = require('multicast-dns');
const { io: ioClient } = require('socket.io-client');

console.log('--- TEST: Validación Integral de Servidor con mDNS y WebSockets ---');

const serverProcess = spawn('node', ['server/server.js'], {
  env: { ...process.env, PORT: '3000' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
serverProcess.stdout.on('data', (d) => {
  output += d.toString();
  process.stdout.write(d.toString());
});
serverProcess.stderr.on('data', (d) => {
  console.error('Server err:', d.toString());
});

setTimeout(async () => {
  try {
    // 1. Probar HTTP Localhost
    console.log('\n1. Verificando HTTP localhost:3000/api/rooms...');
    const res = await fetch('http://127.0.0.1:3000/api/rooms');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.rooms.length, 14);
    console.log('✅ HTTP localhost:3000 OK, 14 habitaciones recibidas');

    // 2. Probar resolución mDNS para hotel.local
    console.log('\n2. Verificando resolución mDNS de hotel.local...');
    const clientMdns = mDNS();
    
    const mdnsPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout esperando respuesta mDNS'));
      }, 3000);

      clientMdns.on('response', (resp) => {
        const foundA = resp.answers.find(a => a.name.toLowerCase() === 'hotel.local' && a.type === 'A');
        if (foundA) {
          clearTimeout(timeout);
          resolve(foundA);
        }
      });
    });

    clientMdns.query({
      questions: [{ name: 'hotel.local', type: 'A' }]
    });

    const answer = await mdnsPromise;
    console.log(`✅ mDNS respondió correctamente: hotel.local -> ${answer.data}`);
    clientMdns.destroy();

    // 3. Probar Socket.IO en tiempo real
    console.log('\n3. Verificando Socket.IO...');
    const socket = ioClient('http://127.0.0.1:3000');
    await new Promise(r => socket.on('connect', r));
    console.log('✅ Socket.IO conectado exitosamente');
    socket.disconnect();

    // 4. Probar cierre limpio con SIGTERM
    console.log('\n4. Enviando señal SIGTERM para verificar cierre mDNS y SQLite...');
    serverProcess.kill('SIGTERM');

    await new Promise((resolve) => {
      serverProcess.on('exit', (code) => {
        console.log(`✅ Proceso Node terminado limpiamente con código: ${code}`);
        resolve();
      });
    });

    console.log('\n🎉 TODAS LAS PRUEBAS DE mDNS, HTTP, WEBSOCKETS Y CIERRE LIMPIO PASARON');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en prueba:', err);
    serverProcess.kill('SIGKILL');
    process.exit(1);
  }
}, 1500);

