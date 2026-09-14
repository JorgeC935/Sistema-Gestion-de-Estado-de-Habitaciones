# Sistema de Control de Habitaciones (Hotel)

SPA minimalista y ligera para gestionar en tiempo real el estado de las 14 habitaciones del hotel mediante red local WiFi.

---

## 1. Instalación de dependencias (Windows / PC)

En la terminal (cmd o PowerShell) dentro de la carpeta del proyecto:
```bash
npm install
```

---

## 2. Ejecutar en Windows para desarrollo

Para iniciar el servidor:
```bash
npm start
```
El servidor arrancará en `http://localhost:3000`.

---

## 3. Acceso desde otros dispositivos de la LAN (Celulares / Tablets / PC)

### Acceso recomendado (mDNS / Zeroconf):
En cualquier celular, tablet o PC conectado a la misma red WiFi/Ethernet, ingresa directamente en el navegador:
```
http://hotel.local:3000
```
*(No necesitas conocer la dirección IP del servidor).*

### Acceso alternativo (IP directa):
Si tu router bloquea tráfico multicast (mDNS) o el dispositivo cliente no tiene soporte Zeroconf, utiliza la dirección IP local que muestra la consola del servidor:
```
http://<IP-DEL-SERVIDOR>:3000
```
Para mayor comodidad, en el navegador del celular toca el menú de opciones (⋮) y selecciona **"Agregar a la pantalla principal"** para crear un acceso directo.

---

## 3.1 Configuración de Firewall de Windows (Si el servidor es una PC)

Asegúrate de que el Firewall de Windows permita la comunicación:
- **Node.js**: Permitir en redes privadas cuando Windows muestre la alerta de seguridad.
- **Puerto TCP 3000**: Entrada permitida para la aplicación web y Socket.IO.
- **Puerto UDP 5353**: Entrada permitida para el tráfico de descubrimiento mDNS (Multicast DNS).
*(No desactives el Firewall de Windows; solo permite las reglas anteriores).*

---

## 4. Instalación en Celular Android (Termux)

1. Instala **Termux** y opcionalmente **Termux:Widget** y **Termux:API** (desde F-Droid).
2. Abre Termux y ejecuta:
   ```bash
   pkg update -y && pkg install nodejs git -y
   ```
3. Copia o clona la carpeta del proyecto a Termux, por ejemplo:
   ```bash
   cd ~
   git clone <URL_REPOSITORIO> hotel
   cd hotel
   npm install
   chmod +x scripts/*.sh
   ```

---

## 5. Iniciar y detener el servidor manualmente en Android

- **Iniciar servidor:**
  ```bash
  ./scripts/start-server.sh
  ```
  *(Se ejecuta en segundo plano, muestra la IP, genera notificación si está disponible y no duplica instancias).*

- **Detener servidor:**
  ```bash
  ./scripts/stop-server.sh
  ```
  *(Pide confirmación previa y cierra SQLite limpiamente sin dañar los datos).*

---

## 6. Accesos directos en Android (Termux:Widget)

Para que el empleado inicie o apague el servidor con un solo toque desde la pantalla de inicio:

1. En Termux, crea la carpeta de accesos directos y enlaza los scripts:
   ```bash
   mkdir -p ~/.shortcuts
   ln -s ~/hotel/scripts/start-server.sh ~/.shortcuts/"🏨 Iniciar Hotel"
   ln -s ~/hotel/scripts/stop-server.sh ~/.shortcuts/"🛑 Apagar Hotel"
   ```
2. Ve a la pantalla de inicio de Android -> Mantén presionado -> **Widgets** -> Busca **Termux:Widget**.
3. Arrastra los dos accesos directos a tu pantalla principal. Al tocarlos, se ejecutarán directamente sin tener que escribir comandos.

---

## 7. Obtener la IP local del celular servidor

- **Desde el script:** Al ejecutar `./scripts/start-server.sh`, la IP se muestra en pantalla y en la notificación.
- **Desde Ajustes de Android:** Ajustes -> Internet y redes / WiFi -> Toca la red conectada -> Opciones avanzadas -> **Dirección IP** (ej. `192.168.1.45`).

