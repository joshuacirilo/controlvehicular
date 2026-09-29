# Rol: Backend Developer

Responsable de: Node.js + Express, controladores, lógica de negocio, autenticación (JWT), WebSockets (Socket.IO), arquitectura MVC del servidor.

## Requerimientos que implementa

**Funcionales**
- RF01, RF02 — Endpoints CRUD para registro de camiones y conductores.
- RF04 — Validar que un camión no tenga ya un trip activo antes de iniciar uno nuevo.
- RF05, RF06 — Recibir pings de ubicación y calcular la velocidad del camión.
- RF08 — Lógica de cierre de trip (finalización de viaje).
- RF09, RF10 — Emitir eventos en tiempo real vía Socket.IO al panel admin.
- RF14 — Endpoints de historial de trips (filtros por camión, conductor, fecha).
- RF16 — Autenticación (JWT) y autorización basada en roles (RBAC) en cada endpoint.

**No funcionales**
- RNF02 — Soportar crecimiento de flota y frecuencia de pings sin degradar rendimiento.
- RNF04, RNF05 — Comunicación cifrada (HTTPS/WSS) y control de acceso por rol a nivel de backend (no solo UI).
- RNF08 — Arquitectura MVC clara: `models/`, `controllers/`, `routes/`, `middleware/`.
- RNF10 — Tolerancia a fallos: aceptar reintentos de pings sin duplicar ni perder datos.

## Plan de 5 días

### Día 1 — Diseño y contratos
- Definir el contrato de la API (rutas, payloads de request/response) para RF01–RF16, en conjunto con Mobile y Frontend.
- Configurar el proyecto Express con estructura MVC (`models/`, `controllers/`, `routes/`, `middleware/`).
- Dejar el esqueleto de autenticación JWT (sin lógica final todavía).
- Coordinar con el DBA el esquema de las 4 colecciones (`trucks`, `drivers`, `trips`, `locationPings`).
- **Entregable:** contrato de API documentado y aprobado por el equipo.

### Día 2 — Modelos y autenticación
- Implementar los modelos Mongoose junto con el DBA (`Truck`, `Driver`, `Trip`, `LocationPing`).
- Implementar `POST /auth/login` y middlewares `verifyToken` / `checkRole`.
- Implementar CRUD de `trucks` y `drivers` (RF01, RF02).
- **Entregable:** login funcional end-to-end (Mobile y Frontend ya pueden autenticarse contra el backend real).

### Día 3 — Lógica de trips
- Implementar `POST /trips/start` (RF03 desde el lado backend, RF04 — validar que el camión no tenga trip activo).
- Implementar `POST /trips/:id/ping` (RF05, RF06 — guardar ping y calcular velocidad).
- Implementar `POST /trips/:id/end` (RF07 desde backend, RF08).
- **Entregable:** un trip completo (inicio → pings → fin) puede registrarse de extremo a extremo desde la API.

### Día 4 — Tiempo real
- Integrar Socket.IO: emitir evento `truck:update` cada vez que llega un ping nuevo.
- Implementar `GET /trips/:id` (historial/detalle de un trip específico).
- Implementar `GET /trucks/live` (lista de camiones actualmente en línea, para la carga inicial del panel admin).
- Revisar con el DBA el rendimiento de escritura bajo carga simulada (varios pings por segundo).
- **Entregable:** demo end-to-end funcionando — posición y velocidad llegan en tiempo real al panel admin.

### Día 5 — Historial, integración y cierre
- Implementar filtros de historial: `GET /trips?truckId=&driverId=&from=&to=` (RF14).
- Implementar endpoint de cierre manual de trip (para cuando el conductor no puede escanear el QR final).
- Participar en pruebas de integración con Mobile y Frontend: casos límite (2 conductores escaneando el mismo camión, pérdida de conexión, reintentos).
- Ajustar manejo de errores y validaciones según lo que salga en las pruebas.
- Preparar variables de entorno y documentación mínima para levantar el backend (README).
- **Entregable:** backend estable, listo para la demo, con documentación de despliegue.
