const assert = require('node:assert');
const db = require('../server/database');

console.log('--- TEST 1: Verificar que existan exactamente las 14 habitaciones requeridas ---');
const rooms = db.getAllRooms();
const roomIds = rooms.map(r => r.id);
const expectedRooms = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 25];
assert.strictEqual(rooms.length, 14, `Se esperaban 14 habitaciones, se obtuvieron ${rooms.length}`);
assert.deepStrictEqual(roomIds, expectedRooms, 'Los IDs de habitaciones deben coincidir exactamente');
console.log('✅ 14 habitaciones verificadas correctamente:', roomIds.join(', '));

console.log('\n--- TEST 2: Comportamiento de estados y hora de salida ---');
// 2.1 Poner habitación 4 en OCUPADA con hora 14:30
const r4 = db.updateRoom(4, 'OCUPADA', '14:30');
assert.strictEqual(r4.estado, 'OCUPADA');
assert.strictEqual(r4.hora_salida, '14:30');
console.log('✅ Habitación 4 puesta en OCUPADA con salida 14:30');

// 2.2 Cambiar a SUCIA debe eliminar la hora de salida
const r4Sucia = db.updateRoom(4, 'SUCIA');
assert.strictEqual(r4Sucia.estado, 'SUCIA');
assert.strictEqual(r4Sucia.hora_salida, null, 'Hora de salida debe eliminarse al pasar a SUCIA');
console.log('✅ Habitación 4 cambiada a SUCIA y hora_salida reseteada a null');

// 2.3 Poner habitación 25 en OCUPADA con hora 20:00 y pasar a LIBRE
db.updateRoom(25, 'OCUPADA', '20:00');
const r25Libre = db.updateRoom(25, 'LIBRE');
assert.strictEqual(r25Libre.estado, 'LIBRE');
assert.strictEqual(r25Libre.hora_salida, null, 'Hora de salida debe eliminarse al pasar a LIBRE');
console.log('✅ Habitación 25 cambiada a LIBRE y hora_salida reseteada a null');

// 2.4 Intentar poner OCUPADA sin hora debe fallar
assert.throws(() => {
  db.updateRoom(1, 'OCUPADA', null);
}, /Hora de salida obligatoria/, 'Debe arrojar error si no se pasa hora en OCUPADA');
console.log('✅ Validación correcta: OCUPADA exige obligatoriamente hora de salida');

// 2.5 Intentar modificar una habitación no permitida
assert.throws(() => {
  db.updateRoom(13, 'LIBRE');
}, /Habitación no permitida/, 'Debe rechazar habitaciones fuera de la lista');
console.log('✅ Validación correcta: No se permiten habitaciones fuera de la lista de 14');

console.log('\n--- TEST 3: Verificación de persistencia ---');
// Dejar habitación 2 OCUPADA a 15:30 y habitación 3 SUCIA
db.updateRoom(2, 'OCUPADA', '15:30');
db.updateRoom(3, 'SUCIA');
db.close();

// Limpiar cache del módulo para simular reinicio del proceso y reapertura de la BD
delete require.cache[require.resolve('../server/database')];
const db2 = require('../server/database');
const r2Check = db2.getRoom(2);
const r3Check = db2.getRoom(3);
assert.strictEqual(r2Check.estado, 'OCUPADA');
assert.strictEqual(r2Check.hora_salida, '15:30');
assert.strictEqual(r3Check.estado, 'SUCIA');
assert.strictEqual(r3Check.hora_salida, null);
console.log('✅ Persistencia en SQLite confirmada tras reapertura de la base de datos');

console.log('\n🎉 TODOS LOS TESTS UNITARIOS Y DE PERSISTENCIA PASARON CON ÉXITO');
process.exit(0);
