# Asignar viaje

El administrador asigna un viaje a un camión y a un piloto, con origen y destino marcados en el mapa y fecha y hora de salida. El piloto lo ve en el apartado **Notificaciones** de la app móvil y recibe un aviso local de Android. Cuando escanea el QR del camión asignado, el viaje real queda vinculado a la asignación.

Sin dependencias nuevas. Sin Firebase ni push remoto. Sin cambios de validadores ni índices en Atlas.

## Decisiones

- **Aviso al piloto:** la app consulta `GET /api/assignments/mine` cada 60 s mientras hay sesión y al volver a primer plano. Las asignaciones nuevas generan una notificación local de Android (canal "Viajes asignados") mediante el canal nativo `control_vehicular/notifications` de `MainActivity.kt`. En web solo existe el apartado dentro de la app.
- **Inicio del viaje:** se sigue escaneando el QR del camión. Si el camión coincide con una asignación `pendiente` del piloto, `startTrip` la pasa a `en_curso` y guarda `trips.assignmentId`. Con otro camión se crea un viaje normal sin vínculo.
- **Fin del viaje:** `endTrip` pasa a `completada` la asignación vinculada. Es idempotente: repetir el cierre vuelve a intentarlo.

## Datos: colección `tripAssignments`

No se usa `trips` para lo programado: su validador estricto solo admite `activo` y `finalizado`.

| Campo | Tipo / nota |
| --- | --- |
| `truckId`, `driverId` | ObjectId de `trucks` y `drivers` (piloto activo y vinculado a `users`) |
| `createdBy` | `{id, username, nombre}` del administrador autenticado |
| `origen`, `destino` | `{type:'Point', coordinates:[lng, lat], nombre}` dentro de Guatemala |
| `programadoPara` | Instante real (UTC). El panel captura fecha y hora de Guatemala (-06:00, sin horario de verano) |
| `nota` | Texto opcional, hasta 500 caracteres |
| `estado` | `pendiente` → `en_curso` → `completada`; `pendiente` → `cancelada` |
| `tripId` | ObjectId del viaje real o null |
| `entregadaAt`, `leidaAt` | La app la recibió / el piloto la abrió (UTC real o null) |
| `iniciadaAt`, `completadaAt`, `canceladaAt` | Marcas de transición (UTC real o null) |
| `createdAt`, `updatedAt` | UTC real |

Las fechas de esta colección usan **UTC real**, como cuentas y notificaciones. Solo `trips` y `locationPings` siguen guardando hora de Guatemala. `trips.assignmentId` es un campo extra permitido por su validador.

Índice recomendado al crecer (infraestructura, **no creado**): `tripAssignments({driverId:1, estado:1, programadoPara:1})` y `tripAssignments({tripId:1})`.

## Reglas de validación

- Camión activo. Piloto activo, con `drivers.userId` y usuario `conductor` activo.
- Origen y destino dentro de `[[13.6, -92.4], [17.9, -88.1]]`, separados al menos 50 m. Nombre opcional de cada punto, hasta 120 caracteres.
- Fecha y hora entre 5 minutos antes de ahora y 366 días después.
- Solo se cancela una asignación `pendiente`, con actualización atómica.
- El piloto solo ve y marca sus asignaciones (`{_id, driverId}` de su sesión).

## Endpoints

| Ruta | Autorización / cuerpo |
| --- | --- |
| GET `/api/assignments?page=N` | Administrador. `{page, totalPages, total, assignments}` |
| POST `/api/assignments` | Administrador, mismo origen. `{truckId, driverId, origen:{lat,lng,nombre}, destino:{lat,lng,nombre}, fecha:'YYYY-MM-DD', hora:'HH:mm', nota}` → 201 |
| POST `/api/assignments/:id/cancel` | Administrador, mismo origen. 409 si ya no está pendiente |
| GET `/api/assignments/mine` | Bearer del piloto. `{assignments:[...]}` pendientes y en curso |
| POST `/api/assignments/:id/delivered` | Bearer del piloto. Marca `entregadaAt` |
| POST `/api/assignments/:id/read` | Bearer del piloto. Marca `leidaAt` (y `entregadaAt` si faltaba) |

`POST /api/trips/start` y `GET /api/trips/active` añaden `assignment` (o null) con el mismo formato que `mine`:

```json
{ "id": "…", "truck": { "placa": "P123ABC", "modelo": "Hino" },
  "origen": { "lat": 14.63, "lng": -90.5, "nombre": "Bodega" },
  "destino": { "lat": 14.55, "lng": -90.73, "nombre": "Cliente" },
  "programadoPara": "2026-10-24T14:00:00.000Z", "nota": "", "estado": "pendiente",
  "entregada": false, "leida": false }
```

## Panel: `/asignar`

- Selectores de camión y piloto (solo activos y vinculados).
- Mapa Leaflet: primer clic marca el origen (A), segundo el destino (B). Los marcadores se pueden arrastrar; "Reiniciar puntos" los borra. Línea recta discontinua entre ambos: no hay cálculo de ruta.
- Fecha, hora (Guatemala) y nota.
- Lista paginada con estado (Pendiente, Recibida, Leída, En curso, Completada, Cancelada) y "Cancelar" para las pendientes.

## App móvil

- `AssignmentWatcher`: consulta cada 60 s y al volver a primer plano; muestra el aviso local de las no entregadas y llama a `delivered`.
- Campana con contador de no leídas en la pantalla principal → `NotificationsPage`. Abrir una asignación la marca como leída.
- Tarjeta "Viaje asignado" con camión, salida, origen y destino mientras haya una pendiente. Durante un viaje vinculado se muestran origen y destino.

## Límites conocidos

- Sin push remoto: el aviso llega solo mientras el proceso de la app esté vivo (primer plano o motor retenido en segundo plano). Si el sistema mata la app, el piloto lo ve al reabrirla.
- Hasta 60 s de retraso por la consulta periódica.
- La línea origen-destino es recta; no hay map matching ni servicio externo de rutas.
- Una asignación no impide iniciar viajes con otros camiones.

## Verificar

Desde `administrador`: `node --test scripts/assignments.test.mjs`, `npm.cmd run lint`, `npx.cmd tsc --noEmit` y `npm.cmd run build` (sin `next dev` activo). Desde `appmovil`: `flutter analyze` y `flutter test`. No generar APK/AAB.

Archivos: `lib/assignments.ts`, `server/assignments/service.ts`, `app/api/assignments/**`, `server/trips/service.ts`, `app/(panel)/asignar/page.tsx`, `components/assignment-*.tsx`; en Flutter `lib/core/assignments.dart`, `lib/notifications_page.dart`, `lib/trip_home_page.dart`, `lib/login_page.dart`, `MainActivity.kt`.
