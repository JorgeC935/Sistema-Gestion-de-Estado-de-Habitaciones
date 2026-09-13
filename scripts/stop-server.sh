#!/data/data/com.termux/files/usr/bin/bash

# Directorio base del proyecto
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$PROJECT_DIR/server.pid"

# 1. Comprobar si existe el proceso
if [ ! -f "$PID_FILE" ]; then
    # Buscar si hay un proceso node server/server.js corriendo
    NODE_PID=$(pgrep -f "node.*server/server.js" | head -n 1)
    if [ -z "$NODE_PID" ]; then
        echo "ℹ️  El servidor del Hotel ya se encuentra apagado."
        exit 0
    fi
else
    NODE_PID=$(cat "$PID_FILE")
fi

if ! ps -p "$NODE_PID" > /dev/null 2>&1; then
    echo "ℹ️  El servidor no está en ejecución."
    rm -f "$PID_FILE"
    exit 0
fi

# 2. Solicitar confirmación
echo "=================================================="
echo "🛑 APAGADO DE SISTEMA DE HABITACIONES"
echo "=================================================="
read -r -p "¿Está seguro de que desea apagar el servidor? (s/N): " CONFIRM
case "$CONFIRM" in
    [sS][iI]|[sS])
        ;;
    *)
        echo "Operación cancelada. El servidor continúa activo."
        exit 0
        ;;
esac

# 3. Envío de señal SIGTERM para cierre limpio de Node y SQLite
echo "Deteniendo servidor de forma segura (PID: $NODE_PID)..."
kill -TERM "$NODE_PID" 2>/dev/null

# Esperar hasta 5 segundos para que termine limpiamente
WAIT_COUNT=0
while ps -p "$NODE_PID" > /dev/null 2>&1 && [ $WAIT_COUNT -lt 5 ]; do
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

# Si no cerró, forzar cierre
if ps -p "$NODE_PID" > /dev/null 2>&1; then
    echo "Forzando cierre..."
    kill -KILL "$NODE_PID" 2>/dev/null
fi

# 4. Limpieza de archivos y notificación
rm -f "$PID_FILE"

if command -v termux-notification-remove > /dev/null 2>&1; then
    termux-notification-remove "hotel_server"
fi

echo "=================================================="
echo "🔴 Servidor apagado correctamente. Base SQLite protegida."
echo "=================================================="

