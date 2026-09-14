const mDNS = require('multicast-dns');
const os = require('node:os');

function normalizeName(name) {
  return (name || '').toLowerCase().trim().replace(/\.+$/, '');
}

class HotelMDNSService {
  constructor(options = {}) {
    this.hostname = options.hostname || 'hotel.local';
    this.serviceName = options.serviceName || 'Sistema Hotel';
    this.serviceType = options.serviceType || '_http._tcp';
    this.port = options.port || 3000;
    this.mdns = null;
    this.ipv4List = [];
    this.ipv6List = [];
  }

  getNetworkAddresses() {
    const interfaces = os.networkInterfaces();
    const ipv4 = [];
    const ipv6 = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.internal) continue;

        if (iface.family === 'IPv4') {
          ipv4.push(iface.address);
        } else if (iface.family === 'IPv6') {
          ipv6.push(iface.address);
        }
      }
    }
    return { ipv4, ipv6 };
  }

  start() {
    const { ipv4, ipv6 } = this.getNetworkAddresses();
    this.ipv4List = ipv4;
    this.ipv6List = ipv6;

    try {
      this.mdns = mDNS({
        multicast: true,
        reuseAddr: true,
        loopback: true
      });
    } catch (err) {
      console.warn('⚠️  No se pudo inicializar socket mDNS:', err.message);
      return;
    }

    this.mdns.on('error', (err) => {
      if (err.code !== 'EADDRINUSE') {
        console.warn('⚠️  Aviso mDNS:', err.message);
      }
    });

    const fqdnHost = this.hostname.endsWith('.local') ? this.hostname : `${this.hostname}.local`;
    const cleanHost = normalizeName(fqdnHost);
    const fqdnServiceType = `${this.serviceType}.local`;
    const cleanServiceType = normalizeName(fqdnServiceType);
    const fqdnInstance = `${this.serviceName}.${fqdnServiceType}`;
    const cleanInstance = normalizeName(fqdnInstance);

    // Manejar consultas entrantes
    this.mdns.on('query', (query, rinfo) => {
      // Refrescar IPs activas
      const current = this.getNetworkAddresses();
      if (current.ipv4.length > 0) this.ipv4List = current.ipv4;
      if (current.ipv6.length > 0) this.ipv6List = current.ipv6;

      if (!this.ipv4List || this.ipv4List.length === 0) return;

      const unicastAnswers = [];
      const multicastAnswers = [];
      const additionals = [];
      let isHotelHostQuery = false;

      const questions = query.questions || [];

      for (const q of questions) {
        const qName = normalizeName(q.name);
        const qType = (q.type || '').toUpperCase();

        // 1. Consulta directa para hotel.local (A, AAAA, o ANY)
        if (qName === cleanHost) {
          isHotelHostQuery = true;

          if (qType === 'A' || qType === 'ANY') {
            for (const ip of this.ipv4List) {
              // Respuesta Unicast (RFC 1035 para resolvers clásicos de celular):
              // class: 'IN', flush: false, repetir el nombre exacto de la pregunta
              unicastAnswers.push({
                name: q.name,
                type: 'A',
                class: 'IN',
                ttl: 120,
                flush: false,
                data: ip
              });

              // Respuesta Multicast (RFC 6762):
              multicastAnswers.push({
                name: fqdnHost,
                type: 'A',
                class: 'IN',
                ttl: 120,
                flush: true,
                data: ip
              });
            }
          } else if (qType === 'AAAA') {
            // Si el cliente pide IPv6 (AAAA), responder con las direcciones IPv6 si existen
            for (const ip6 of this.ipv6List) {
              const cleanIp6 = ip6.split('%')[0];
              unicastAnswers.push({
                name: q.name,
                type: 'AAAA',
                class: 'IN',
                ttl: 120,
                flush: false,
                data: cleanIp6
              });
              multicastAnswers.push({
                name: fqdnHost,
                type: 'AAAA',
                class: 'IN',
                ttl: 120,
                flush: true,
                data: cleanIp6
              });
            }
            // Y siempre adjuntar IPv4 en additionals
            for (const ip of this.ipv4List) {
              additionals.push({
                name: fqdnHost,
                type: 'A',
                class: 'IN',
                ttl: 120,
                flush: false,
                data: ip
              });
            }
          }
        }

        // 2. Consulta de descubrimiento de servicios (_http._tcp.local)
        if ((qName === '_services._dns-sd._udp.local' || qName === cleanServiceType) &&
            (qType === 'PTR' || qType === 'ANY')) {
          multicastAnswers.push({
            name: fqdnServiceType,
            type: 'PTR',
            ttl: 120,
            data: fqdnInstance
          });
          additionals.push({
            name: fqdnInstance,
            type: 'SRV',
            ttl: 120,
            flush: true,
            data: { priority: 0, weight: 0, port: this.port, target: fqdnHost }
          });
          additionals.push({
            name: fqdnInstance,
            type: 'TXT',
            ttl: 120,
            flush: true,
            data: ['txtvers=1', 'path=/']
          });
          for (const ip of this.ipv4List) {
            additionals.push({
              name: fqdnHost,
              type: 'A',
              ttl: 120,
              flush: true,
              data: ip
            });
          }
        }

        // 3. Consulta de instancia concreta ("Sistema Hotel._http._tcp.local")
        if (qName === cleanInstance) {
          if (qType === 'SRV' || qType === 'ANY') {
            multicastAnswers.push({
              name: fqdnInstance,
              type: 'SRV',
              ttl: 120,
              flush: true,
              data: { priority: 0, weight: 0, port: this.port, target: fqdnHost }
            });
          }
          if (qType === 'TXT' || qType === 'ANY') {
            multicastAnswers.push({
              name: fqdnInstance,
              type: 'TXT',
              ttl: 120,
              flush: true,
              data: ['txtvers=1', 'path=/']
            });
          }
          for (const ip of this.ipv4List) {
            additionals.push({
              name: fqdnHost,
              type: 'A',
              ttl: 120,
              flush: true,
              data: ip
            });
          }
        }
      }

      if (isHotelHostQuery || multicastAnswers.length > 0) {
        const clientAddr = rinfo ? `${rinfo.address}:${rinfo.port}` : 'desconocido';
        const types = questions.map(q => q.type).join(', ');
        console.log(`📡 [mDNS] Consulta resuelta para ${clientAddr} (tipos: ${types}) -> ${this.ipv4List[0]}`);

        // A) RESPUESTA UNICAST DIRECTA AL CELULAR
        // Es vital incluir 'questions' (RFC 1035) y 'id' idéntico para que el resolver de Android/Chrome lo acepte
        if (rinfo && rinfo.address && rinfo.port && unicastAnswers.length > 0) {
          try {
            this.mdns.respond({
              id: query.id || 0,
              questions: query.questions,
              answers: unicastAnswers,
              additionals: additionals
            }, rinfo);
          } catch (e) {
            // Ignorar fallos de socket
          }
        }

        // B) RESPUESTA MULTICAST ESTÁNDAR
        if (multicastAnswers.length > 0) {
          try {
            this.mdns.respond({
              answers: multicastAnswers,
              additionals: additionals
            });
          } catch (e) {
            // Ignorar fallos de socket
          }
        }
      }
    });

    // Enviar anuncio inicial en la red
    this.announce(120);
  }

  announce(ttl = 120) {
    if (!this.mdns || this.ipv4List.length === 0) return;
    const fqdnHost = this.hostname.endsWith('.local') ? this.hostname : `${this.hostname}.local`;
    const fqdnServiceType = `${this.serviceType}.local`;
    const fqdnInstance = `${this.serviceName}.${fqdnServiceType}`;

    const answers = [
      {
        name: fqdnServiceType,
        type: 'PTR',
        ttl,
        data: fqdnInstance
      },
      {
        name: fqdnInstance,
        type: 'SRV',
        ttl,
        flush: true,
        data: { priority: 0, weight: 0, port: this.port, target: fqdnHost }
      },
      {
        name: fqdnInstance,
        type: 'TXT',
        ttl,
        flush: true,
        data: ['txtvers=1', 'path=/']
      }
    ];

    for (const ip of this.ipv4List) {
      answers.push({
        name: fqdnHost,
        type: 'A',
        ttl,
        flush: true,
        data: ip
      });
    }

    try {
      this.mdns.respond({ answers });
    } catch (err) {
      // Ignorar
    }
  }

  stop(callback) {
    if (!this.mdns) {
      if (typeof callback === 'function') callback();
      return;
    }

    try {
      this.announce(0);
      this.mdns.destroy(() => {
        this.mdns = null;
        if (typeof callback === 'function') callback();
      });
    } catch (err) {
      this.mdns = null;
      if (typeof callback === 'function') callback();
    }
  }
}

module.exports = HotelMDNSService;
