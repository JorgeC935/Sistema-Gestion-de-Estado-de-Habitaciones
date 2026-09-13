// Estado local de habitaciones en el cliente
let roomsData = new Map();
let currentRoomModalId = null;
let selectedHour = '12';
let selectedMinute = '00';

// Elementos DOM
const roomsGrid = document.getElementById('roomsGrid');
const headerClock = document.getElementById('headerClock');
const connectionStatus = document.getElementById('connectionStatus');

// Modal Elements
const timeModal = document.getElementById('timeModal');
const modalTitle = document.getElementById('modalTitle');
const dispHoras = document.getElementById('dispHoras');
const dispMinutos = document.getElementById('dispMinutos');
const hoursGrid = document.getElementById('hoursGrid');
const minutesGrid = document.getElementById('minutesGrid');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnCancelAction = document.getElementById('btnCancelAction');
const btnConfirmOcupada = document.getElementById('btnConfirmOcupada');

// ============================================================================
// 1. INICIALIZACIÓN DEL SELECTOR DE HORA (24H DIGITAL CLOCK STYLE)
// ============================================================================
function initTimePicker() {
  // Generar Horas (00 a 23)
  hoursGrid.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const hh = String(i).padStart(2, '0');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-time-chip';
    btn.textContent = hh;
    btn.dataset.hour = hh;
    btn.addEventListener('click', () => {
      selectedHour = hh;
      updateTimePickerDisplay();
    });
    hoursGrid.appendChild(btn);
  }

  // Generar Minutos (00 a 55 de 5 en 5 minutos)
  minutesGrid.innerHTML = '';
  for (let i = 0; i < 60; i += 5) {
    const mm = String(i).padStart(2, '0');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-time-chip';
    btn.textContent = mm;
    btn.dataset.minute = mm;
    btn.addEventListener('click', () => {
      selectedMinute = mm;
      updateTimePickerDisplay();
    });
    minutesGrid.appendChild(btn);
  }

  // Eventos de botones cerrar/cancelar
  btnCancelModal.addEventListener('click', closeTimeModal);
  btnCancelAction.addEventListener('click', closeTimeModal);

  // Confirmar estado OCUPADA con hora elegida
  btnConfirmOcupada.addEventListener('click', () => {
    if (currentRoomModalId === null) return;
    const horaSalida = `${selectedHour}:${selectedMinute}`;
    updateRoomState(currentRoomModalId, 'OCUPADA', horaSalida);
    closeTimeModal();
  });

  // Cerrar modal al hacer clic en el backdrop
  timeModal.addEventListener('click', (e) => {
    if (e.target === timeModal) {
      closeTimeModal();
    }
  });
}

function updateTimePickerDisplay() {
  dispHoras.textContent = selectedHour;
  dispMinutos.textContent = selectedMinute;

  // Actualizar clase selected en horas
  hoursGrid.querySelectorAll('.btn-time-chip').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.hour === selectedHour);
  });

  // Actualizar clase selected en minutos
  minutesGrid.querySelectorAll('.btn-time-chip').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.minute === selectedMinute);
  });
}

function openTimeModal(roomId) {
  currentRoomModalId = roomId;
  modalTitle.textContent = `Habitación ${roomId} — Hora de Salida`;

  const room = roomsData.get(Number(roomId));
  if (room && room.hora_salida) {
    const [hh, mm] = room.hora_salida.split(':');
    selectedHour = hh || '12';
    // Redondear al múltiplo de 5 más cercano si es necesario
    const minNum = Math.round(Number(mm || 0) / 5) * 5;
    selectedMinute = String(minNum >= 60 ? 55 : minNum).padStart(2, '0');
  } else {
    // Por defecto hora actual + 2 horas para comodidad del recepcionista
    const now = new Date();
    const defaultHour = (now.getHours() + 2) % 24;
    selectedHour = String(defaultHour).padStart(2, '0');
    selectedMinute = '00';
  }

  updateTimePickerDisplay();
  timeModal.style.display = 'flex';
}

function closeTimeModal() {
  timeModal.style.display = 'none';
  currentRoomModalId = null;
}

// ============================================================================
// 2. LÓGICA DE FUERA DE HORA Y RELOJ
// ============================================================================
function isFueraDeHora(horaSalida) {
  if (!horaSalida) return false;
  const parts = horaSalida.split(':');
  if (parts.length !== 2) return false;
  const h = Number(parts[0]);
  const m = Number(parts[1]);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const salidaMinutes = h * 60 + m;

  return currentMinutes > salidaMinutes;
}

function updateClockAndCheckFueraDeHora() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  
  headerClock.textContent = `${hh}:${mm}:${ss}`;

  // Actualizar dinámicamente visualización de fuera de hora sin recargar
  roomsData.forEach((room) => {
    if (room.estado === 'OCUPADA') {
      renderRoomCard(room);
    }
  });
}

// ============================================================================
// 3. RENDERIZADO DE HABITACIONES
// ============================================================================
function renderRoomCard(room) {
  let card = document.getElementById(`room-card-${room.id}`);
  const fueraDeHora = room.estado === 'OCUPADA' && isFueraDeHora(room.hora_salida);

  // Determinar clases visuales
  let cardStateClass = 'state-libre';
  let badgeHtml = '<span class="room-badge badge-libre">LIBRE</span>';
  let infoHtml = '<div class="info-content"><span class="info-empty">Disponible</span></div>';

  if (room.estado === 'SUCIA') {
    cardStateClass = 'state-sucia';
    badgeHtml = '<span class="room-badge badge-sucia">SUCIA</span>';
    infoHtml = '<div class="info-content"><span class="info-empty">Pendiente Limpieza</span></div>';
  } else if (room.estado === 'OCUPADA') {
    if (fueraDeHora) {
      cardStateClass = 'state-fuerahora';
      badgeHtml = '<span class="room-badge badge-fuerahora">⚠️ FUERA DE HORA</span>';
      infoHtml = `
        <div class="info-content" title="Clic para modificar hora de salida">
          <span class="info-label">Salida:</span>
          <span class="info-time">${room.hora_salida}</span>
          <span class="alert-fuerahora">Excedida</span>
        </div>
      `;
    } else {
      cardStateClass = 'state-ocupada';
      badgeHtml = '<span class="room-badge badge-ocupada">OCUPADA</span>';
      infoHtml = `
        <div class="info-content" title="Clic para modificar hora de salida">
          <span class="info-label">Salida:</span>
          <span class="info-time">${room.hora_salida}</span>
        </div>
      `;
    }
  }

  if (!card) {
    card = document.createElement('div');
    card.id = `room-card-${room.id}`;
    card.className = `room-card ${cardStateClass}`;

    card.innerHTML = `
      <div class="room-header">
        <span class="room-number">Habitación ${room.id}</span>
        <div class="badge-slot">${badgeHtml}</div>
      </div>
      <div class="room-info" id="room-info-${room.id}">
        ${infoHtml}
      </div>
      <div class="room-actions">
        <button type="button" class="btn-state btn-state-libre ${room.estado === 'LIBRE' ? 'active' : ''}" data-action="libre">
          LIBRE
        </button>
        <button type="button" class="btn-state btn-state-ocupada ${room.estado === 'OCUPADA' ? 'active' : ''}" data-action="ocupada">
          OCUPADA
        </button>
        <button type="button" class="btn-state btn-state-sucia ${room.estado === 'SUCIA' ? 'active' : ''}" data-action="sucia">
          SUCIA
        </button>
      </div>
    `;

    // Asignar eventos a los botones de acción rápida
    const btnLibre = card.querySelector('[data-action="libre"]');
    const btnOcupada = card.querySelector('[data-action="ocupada"]');
    const btnSucia = card.querySelector('[data-action="sucia"]');
    const roomInfo = card.querySelector('.room-info');

    btnLibre.addEventListener('click', () => updateRoomState(room.id, 'LIBRE'));
    btnSucia.addEventListener('click', () => updateRoomState(room.id, 'SUCIA'));
    btnOcupada.addEventListener('click', () => openTimeModal(room.id));
    roomInfo.addEventListener('click', () => {
      // Si está ocupada o fuera de hora, permite ajustar la hora al tocar la tarjeta
      if (room.estado === 'OCUPADA') {
        openTimeModal(room.id);
      }
    });

    roomsGrid.appendChild(card);
  } else {
    // Actualizar tarjeta existente
    card.className = `room-card ${cardStateClass}`;
    const badgeSlot = card.querySelector('.badge-slot');
    if (badgeSlot) badgeSlot.innerHTML = badgeHtml;

    const infoSlot = card.querySelector('.room-info');
    if (infoSlot) infoSlot.innerHTML = infoHtml;

    const btnLibre = card.querySelector('[data-action="libre"]');
    const btnOcupada = card.querySelector('[data-action="ocupada"]');
    const btnSucia = card.querySelector('[data-action="sucia"]');

    if (btnLibre) btnLibre.classList.toggle('active', room.estado === 'LIBRE');
    if (btnOcupada) btnOcupada.classList.toggle('active', room.estado === 'OCUPADA');
    if (btnSucia) btnSucia.classList.toggle('active', room.estado === 'SUCIA');
  }
}

function renderAllRooms(roomsList) {
  // Ordenar según especificación: 1-12, 24, 25
  const orderMap = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, 11:11, 12:12, 24:13, 25:14 };
  roomsList.sort((a, b) => (orderMap[a.id] || a.id) - (orderMap[b.id] || b.id));

  roomsList.forEach(room => {
    roomsData.set(Number(room.id), room);
    renderRoomCard(room);
  });
}

// ============================================================================
// 4. ENVÍO Y ACTUALIZACIÓN EN TIEMPO REAL (SOCKET.IO)
// ============================================================================
let socket = null;

function setConnectionState(connected) {
  if (connected) {
    connectionStatus.className = 'connection-pill connected';
    connectionStatus.querySelector('.status-text').textContent = 'Conectado';
  } else {
    connectionStatus.className = 'connection-pill disconnected';
    connectionStatus.querySelector('.status-text').textContent = 'Sin conexión';
  }
}

function initSocket() {
  if (typeof io === 'undefined') {
    console.error('Socket.IO no está cargado');
    setConnectionState(false);
    return;
  }

  socket = io();

  socket.on('connect', () => {
    setConnectionState(true);
  });

  socket.on('disconnect', () => {
    setConnectionState(false);
  });

  socket.on('connect_error', () => {
    setConnectionState(false);
  });

  // Recibir todas las habitaciones al conectarse
  socket.on('rooms:all', (rooms) => {
    renderAllRooms(rooms);
  });

  // Recibir actualización de una habitación en tiempo real
  socket.on('room:updated', (updatedRoom) => {
    roomsData.set(Number(updatedRoom.id), updatedRoom);
    renderRoomCard(updatedRoom);
  });
}

function updateRoomState(id, estado, hora_salida = null) {
  const payload = {
    id: Number(id),
    estado,
    hora_salida: estado === 'OCUPADA' ? hora_salida : null
  };

  // Enviar por WebSocket si está conectado
  if (socket && socket.connected) {
    socket.emit('room:update', payload);
  } else {
    // Fallback REST API
    fetch(`/api/rooms/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.room) {
        roomsData.set(Number(data.room.id), data.room);
        renderRoomCard(data.room);
      }
    })
    .catch(err => {
      console.error('Error al actualizar habitación vía API:', err);
    });
  }
}

// Carga inicial vía REST por si Socket tarda en emitir
function fetchInitialRooms() {
  fetch('/api/rooms')
    .then(res => res.json())
    .then(data => {
      if (data.success && Array.isArray(data.rooms)) {
        renderAllRooms(data.rooms);
      }
    })
    .catch(err => {
      console.warn('Carga inicial API en espera de socket:', err.message);
    });
}

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  initTimePicker();
  initSocket();
  fetchInitialRooms();

  // Reloj y verificación de fuera de hora cada segundo
  updateClockAndCheckFueraDeHora();
  setInterval(updateClockAndCheckFueraDeHora, 1000);
});

