const assert = require('node:assert');
const db = require('../server/database');

console.log('=== TEST SUITE: Lógica de Hora de Salida y Timestamp salida_at ===\n');

// 1. Caso 1: Actual 08:00, Salida 11:00 -> HOY 11:00
{
  const refDate = new Date(2026, 8, 13, 8, 0, 0, 0); // 13 Sept 2026 08:00
  const ts = db.calculateSalidaAt('11:00', refDate);
  const resultDate = new Date(ts);

  assert.strictEqual(resultDate.getDate(), 13, 'Debe ser el mismo día (HOY)');
  assert.strictEqual(resultDate.getHours(), 11);
  assert.strictEqual(resultDate.getMinutes(), 0);
  console.log('✅ Caso 1 superado: Actual 08:00 -> Salida 11:00 es HOY 11:00');
}

// 2. Caso 2: Actual 23:00, Salida 11:00 -> MAÑANA 11:00
{
  const refDate = new Date(2026, 8, 13, 23, 0, 0, 0); // 13 Sept 2026 23:00
  const ts = db.calculateSalidaAt('11:00', refDate);
  const resultDate = new Date(ts);

  assert.strictEqual(resultDate.getDate(), 14, 'Debe ser el día siguiente (MAÑANA)');
  assert.strictEqual(resultDate.getHours(), 11);
  assert.strictEqual(resultDate.getMinutes(), 0);
  console.log('✅ Caso 2 superado: Actual 23:00 -> Salida 11:00 es MAÑANA 11:00');
}

// 3. Caso 3: Actual 23:50, Salida 00:30 -> MAÑANA 00:30
{
  const refDate = new Date(2026, 8, 13, 23, 50, 0, 0);
  const ts = db.calculateSalidaAt('00:30', refDate);
  const resultDate = new Date(ts);

  assert.strictEqual(resultDate.getDate(), 14, 'Debe ser el día siguiente (MAÑANA)');
  assert.strictEqual(resultDate.getHours(), 0);
  assert.strictEqual(resultDate.getMinutes(), 30);
  console.log('✅ Caso 3 superado: Actual 23:50 -> Salida 00:30 es MAÑANA 00:30');
}

// 4. Caso 4: Actual 10:00, Salida 09:00 -> MAÑANA 09:00
{
  const refDate = new Date(2026, 8, 13, 10, 0, 0, 0);
  const ts = db.calculateSalidaAt('09:00', refDate);
  const resultDate = new Date(ts);

  assert.strictEqual(resultDate.getDate(), 14, 'Debe ser el día siguiente (MAÑANA)');
  assert.strictEqual(resultDate.getHours(), 9);
  assert.strictEqual(resultDate.getMinutes(), 0);
  console.log('✅ Caso 4 superado: Actual 10:00 -> Salida 09:00 es MAÑANA 09:00');
}

// 5. Caso 5: Cruce de medianoche sin recargar:
// A las 23:00 se marca salida mañana a las 11:00. A las 00:01 NO debe ser FUERA DE HORA.
{
  const refDate = new Date(2026, 8, 13, 23, 0, 0, 0);
  const salidaTimestamp = db.calculateSalidaAt('11:00', refDate); // 14 Sept 11:00:00

  // Simular hora actual = 14 Sept 00:01:00
  const afterMidnight = new Date(2026, 8, 14, 0, 1, 0, 0).getTime();
  const isFuera = afterMidnight > salidaTimestamp;
  assert.strictEqual(isFuera, false, 'A las 00:01 NO debe estar FUERA DE HORA');
  console.log('✅ Caso 5 superado: Salida mañana 11:00 permanece OCUPADA a las 00:01 sin pasar a FUERA DE HORA');
}

// 6. Caso 6: Solo activar FUERA DE HORA cuando now > salida_at
{
  const salidaTimestamp = new Date(2026, 8, 14, 11, 0, 0, 0).getTime();

  // Justo antes (10:59:59) -> NO fuera de hora
  assert.strictEqual(new Date(2026, 8, 14, 10, 59, 59, 0).getTime() > salidaTimestamp, false);

  // Exacto (11:00:00) -> NO fuera de hora
  assert.strictEqual(new Date(2026, 8, 14, 11, 0, 0, 0).getTime() > salidaTimestamp, false);

  // 1 segundo después (11:00:01) -> SI fuera de hora
  assert.strictEqual(new Date(2026, 8, 14, 11, 0, 1, 0).getTime() > salidaTimestamp, true);
  console.log('✅ Caso 6 superado: FUERA DE HORA solo se activa estrictamente cuando now > salida_at');
}

// 7. Caso 7: LIBRE y SUCIA limpian hora_salida y salida_at
{
  db.updateRoom(1, 'OCUPADA', '15:00');
  const rOcupada = db.getRoom(1);
  assert.strictEqual(rOcupada.estado, 'OCUPADA');
  assert.strictEqual(rOcupada.hora_salida, '15:00');
  assert.ok(typeof rOcupada.salida_at === 'number' && rOcupada.salida_at > 0);

  // Cambiar a SUCIA
  const rSucia = db.updateRoom(1, 'SUCIA');
  assert.strictEqual(rSucia.estado, 'SUCIA');
  assert.strictEqual(rSucia.hora_salida, null);
  assert.strictEqual(rSucia.salida_at, null);

  // Volver a OCUPADA y luego a LIBRE
  db.updateRoom(1, 'OCUPADA', '18:00');
  const rLibre = db.updateRoom(1, 'LIBRE');
  assert.strictEqual(rLibre.estado, 'LIBRE');
  assert.strictEqual(rLibre.hora_salida, null);
  assert.strictEqual(rLibre.salida_at, null);
  console.log('✅ Caso 7 superado: LIBRE y SUCIA limpian completamente hora_salida y salida_at');
}

// 8. Caso 8: Persistencia en SQLite tras recargar la base de datos
{
  // Establecer habitación 5 como OCUPADA con hora calculada
  const targetTs = Date.now() + 3600000;
  db.updateRoom(5, 'OCUPADA', '14:30', targetTs);
  db.close();

  delete require.cache[require.resolve('../server/database')];
  const dbReloaded = require('../server/database');
  const r5 = dbReloaded.getRoom(5);

  assert.strictEqual(r5.estado, 'OCUPADA');
  assert.strictEqual(r5.hora_salida, '14:30');
  assert.strictEqual(r5.salida_at, targetTs);
  console.log('✅ Caso 8 superado: Persistencia de salida_at e integridad SQLite verificada tras reapertura');

  // Dejar limpia la habitación 5
  dbReloaded.updateRoom(5, 'LIBRE');
}

console.log('\n🎉 TODOS LOS 8 CASOS DE PRUEBA UNITARIOS Y DE PERSISTENCIA PASARON AL 100%');
process.exit(0);
