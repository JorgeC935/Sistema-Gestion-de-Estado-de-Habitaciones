#!/data/data/com.termux/files/usr/bin/bash

# Directorio base del proyecto
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$PROJECT_DIR/server.pid"
LOG_FILE="$PROJECT_DIR/server.log"
PORT=3000

cd "$PROJECT_DIR" || exit 1

# 1. Comprobar si ya está en ejecución
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "=================================================="
        echo "⚠️  El servidor del Hotel ya está en ejecución (PID: $PID)"
        echo "=================================================="
        # Abrir navegador si está disponible
        if command -v termux-open-url > /dev/null 2>&1; then
            termux-open-url "http://localhost:$PORT"
        fi
        exit 0
    else
        # Proceso muerto pero quedó el archivo PID
        rm -f "$PID_FILE"
    fi
fi

# 2. Iniciar servidor en segundo plano
echo "Iniciando Servidor del Hotel en puerto $PORT..."
nohup node server/server.js > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# Esperar 1 segundo para verificar arranque
sleep 1
if ! ps -p "$SERVER_PID" > /dev/null 2>&1; then
    echo "❌ Error: El servidor no pudo iniciar. Revisa server.log:"
    tail -n 10 "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi

# 3. Detectar IP local genérica mediante Node.js (compatible con WiFi, Ethernet y datos)
LOCAL_IP=$(node -e "const os=require('os');const i=os.networkInterfaces();for(const n in i){for(const f of i[n]){if(f.family==='IPv4'&&!f.internal){console.log(f.address);process.exit(0);}}}")
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

echo "=================================================="
echo "🏨 Sistema Hotel activo"
echo "🟢 Estado: ACTIVO (PID: $SERVER_PID)"
echo ""
echo "👉 Acceso recomendado (mDNS):"
echo "   http://hotel.local:$PORT"
echo ""
echo "👉 Acceso alternativo (IP directa):"
echo "   http://localhost:$PORT"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "   http://$LOCAL_IP:$PORT"
fi
echo "=================================================="

# 4. Notificación persistente en Android (si Termux:API está instalado)
if command -v termux-notification > /dev/null 2>&1; then
    termux-notification \
        --id "hotel_server" \
        --title "🏨 Sistema Hotel activo" \
        --content "hotel.local:$PORT" \
        --ongoing \
        --priority max \
        --alert-once
fi

# 5. Abrir navegador en el celular servidor
if command -v termux-open-url > /dev/null 2>&1; then
    termux-open-url "http://localhost:$PORT"
elif command -v xdg-open > /dev/null 2>&1; then
    xdg-open "http://localhost:$PORT" > /dev/null 2>&1
fi

