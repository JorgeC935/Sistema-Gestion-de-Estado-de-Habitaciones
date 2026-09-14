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

// Base table creation
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY,
    estado TEXT NOT NULL CHECK(estado IN ('LIBRE', 'OCUPADA', 'SUCIA')),
    hora_salida TEXT DEFAULT NULL,
    salida_at INTEGER DEFAULT NULL
  );
`);

// Migration: Ensure salida_at exists on existing databases
const tableCols = db.prepare('PRAGMA table_info(rooms)').all();
if (!tableCols.some(c => c.name === 'salida_at')) {
  db.exec('ALTER TABLE rooms ADD COLUMN salida_at INTEGER DEFAULT NULL;');
}

// Exact 14 rooms: 1-12, 24, 25
const REQUIRED_ROOMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 25];

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO rooms (id, estado, hora_salida, salida_at)
  VALUES (?, 'LIBRE', NULL, NULL)
`);

for (const roomId of REQUIRED_ROOMS) {
  insertStmt.run(roomId);
}

/**
 * Calcula el timestamp Unix en milisegundos de la salida infiriendo hoy o mañana:
 * - Si la hora seleccionada >= hora actual: corresponde a HOY.
 * - Si la hora seleccionada < hora actual: corresponde a MAÑANA.
 */
function calculateSalidaAt(hora_salida, referenceDate = new Date()) {
  if (!hora_salida || typeof hora_salida !== 'string') return null;
  const parts = hora_salida.split(':');
  if (parts.length !== 2) return null;

  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return null;

  const target = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    h,
    m,
    0,
    0
  );

  const currentHour = referenceDate.getHours();
  const currentMinute = referenceDate.getMinutes();

  // Si la hora seleccionada es menor a la actual, corresponde a mañana
  if (h < currentHour || (h === currentHour && m < currentMinute)) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime();
}

function getAllRooms() {
  const stmt = db.prepare(`
    SELECT id, estado, hora_salida, salida_at 
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
  const stmt = db.prepare('SELECT id, estado, hora_salida, salida_at FROM rooms WHERE id = ?');
  return stmt.get(Number(id));
}

function updateRoom(id, estado, hora_salida = null, salida_at = null) {
  const numId = Number(id);
  if (!REQUIRED_ROOMS.includes(numId)) {
    throw new Error(`Habitación no permitida: ${id}`);
  }

  const validEstados = ['LIBRE', 'OCUPADA', 'SUCIA'];
  if (!validEstados.includes(estado)) {
    throw new Error(`Estado inválido: ${estado}`);
  }

  // Si es LIBRE o SUCIA, se limpian hora_salida y salida_at completamente
  let cleanHoraSalida = null;
  let cleanSalidaAt = null;

  if (estado === 'OCUPADA') {
    if (!hora_salida || !/^\d{2}:\d{2}$/.test(hora_salida)) {
      throw new Error('Hora de salida obligatoria en formato HH:MM para estado OCUPADA');
    }
    cleanHoraSalida = hora_salida;

    // Si se pasa un timestamp numérico válido, se utiliza; de lo contrario se calcula
    if (typeof salida_at === 'number' && !isNaN(salida_at) && salida_at > 0) {
      cleanSalidaAt = salida_at;
    } else {
      cleanSalidaAt = calculateSalidaAt(cleanHoraSalida);
    }
  }

  const stmt = db.prepare(`
    UPDATE rooms 
    SET estado = ?, hora_salida = ?, salida_at = ?
    WHERE id = ?
  `);
  stmt.run(estado, cleanHoraSalida, cleanSalidaAt, numId);

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
  calculateSalidaAt,
  getAllRooms,
  getRoom,
  updateRoom,
  close
};
