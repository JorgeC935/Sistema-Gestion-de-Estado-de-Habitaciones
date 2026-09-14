const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const express = require('express');
const { Server } = require('socket.io');
const db = require('./database');
const HotelMDNSService = require('./mdns');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Instancia de servicio mDNS para publicar hotel.local y servicio HTTP
const mdnsService = new HotelMDNSService({
  hostname: 'hotel.local',
  serviceName: 'Sistema Hotel',
  serviceType: '_http._tcp',
  port: PORT
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Endpoints
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = db.getAllRooms();
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/rooms/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { estado, hora_salida, salida_at } = req.body;

    const updatedRoom = db.updateRoom(id, estado, hora_salida, salida_at);
    
    // Broadcast to all connected clients
    io.emit('room:updated', updatedRoom);

    res.json({ success: true, room: updatedRoom });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  // Send current state on connection
  try {
    const rooms = db.getAllRooms();
    socket.emit('rooms:all', rooms);
  } catch (err) {
    console.error('Error al obtener habitaciones para nuevo cliente:', err.message);
  }

  socket.on('room:update', (data) => {
    try {
      const { id, estado, hora_salida, salida_at } = data;
      const updatedRoom = db.updateRoom(id, estado, hora_salida, salida_at);
      // Broadcast to EVERY client including sender
      io.emit('room:updated', updatedRoom);
    } catch (err) {
      console.error('Error al actualizar habitación por socket:', err.message);
      socket.emit('room:error', { id: data.id, error: err.message });
    }
  });
});

// Helper to list local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

server.listen(PORT, HOST, () => {
  // Iniciar anuncio mDNS
  mdnsService.start();

  const localIps = getLocalIPs();
  console.log('==================================================');
  console.log('🏨 Sistema Hotel activo');
  console.log(`📡 Escuchando en todas las interfaces (${HOST}:${PORT})`);
  console.log('');
  console.log('👉 Acceso recomendado (mDNS):');
  console.log(`   http://hotel.local:${PORT}`);
  console.log('');
  console.log('👉 Acceso alternativo (IP directa):');
  console.log(`   http://localhost:${PORT}`);
  if (localIps.length > 0) {
    localIps.forEach(ip => console.log(`   http://${ip}:${PORT}`));
  }
  console.log('==================================================');
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\nCerrando servidor (${signal})...`);
  
  // Cerrar anuncio mDNS y liberar socket UDP
  mdnsService.stop(() => {
    server.close(() => {
      db.close();
      console.log('Servidor, mDNS y base de datos cerrados limpiamente.');
      process.exit(0);
    });
  });

  // Force exit after 3s if pending connections hang
  setTimeout(() => {
    process.exit(0);
  }, 3000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));


