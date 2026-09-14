const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'hotel.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY,
    estado TEXT NOT NULL CHECK(estado IN ('LIBRE', 'OCUPADA', 'SUCIA')),
    hora_salida TEXT DEFAULT NULL
  );
`);

// Exact 14 rooms: 1-12, 24, 25
const REQUIRED_ROOMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 25];

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO rooms (id, estado, hora_salida)
  VALUES (?, 'LIBRE', NULL)
`);

for (const roomId of REQUIRED_ROOMS) {
  insertStmt.run(roomId);
}

function getAllRooms() {
  const stmt = db.prepare(`
    SELECT id, estado, hora_salida 
    FROM rooms 
    WHERE id IN (${REQUIRED_ROOMS.join(',')})
    ORDER BY CASE 
      WHEN id <= 12 THEN id 
      WHEN id = 24 THEN 13 
      WHEN id = 25 THEN 14 
      ELSE id 
    END ASC
  `);
  return stmt.all();
}

function getRoom(id) {
  const stmt = db.prepare('SELECT id, estado, hora_salida FROM rooms WHERE id = ?');
  return stmt.get(Number(id));
}

function updateRoom(id, estado, hora_salida = null) {
  const numId = Number(id);
  if (!REQUIRED_ROOMS.includes(numId)) {
    throw new Error(`Habitación no permitida: ${id}`);
  }

  const validEstados = ['LIBRE', 'OCUPADA', 'SUCIA'];
  if (!validEstados.includes(estado)) {
    throw new Error(`Estado inválido: ${estado}`);
  }

  // When LIBRE or SUCIA, hora_salida is reset to null
  let cleanHoraSalida = null;
  if (estado === 'OCUPADA') {
    if (!hora_salida || !/^\d{2}:\d{2}$/.test(hora_salida)) {
      throw new Error('Hora de salida obligatoria en formato HH:MM para estado OCUPADA');
    }
    cleanHoraSalida = hora_salida;
  }

  const stmt = db.prepare(`
    UPDATE rooms 
    SET estado = ?, hora_salida = ?
    WHERE id = ?
  `);
  stmt.run(estado, cleanHoraSalida, numId);

  return getRoom(numId);
}

function close() {
  try {
    db.close();
  } catch (err) {
    console.error('Error al cerrar base de datos:', err);
  }
}

module.exports = {
  REQUIRED_ROOMS,
  getAllRooms,
  getRoom,
  updateRoom,
  close
};

