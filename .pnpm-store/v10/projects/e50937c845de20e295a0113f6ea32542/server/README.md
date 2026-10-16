# Configuracion privada del servidor

Las credenciales locales viven en administrador/.env.local, excluido de Git.
Para otro equipo, copiar administrador/.env.example a administrador/.env.local
 y completar MONGODB_URI. En producción usar los secretos del hosting.

Consumir getMongoConfig() de server/env.ts exclusivamente desde codigo servidor.
El marcador server-only impide importarlo en componentes cliente de Next.js.
No pasar el objeto devuelto a componentes cliente, respuestas HTTP ni logs.
No usar NEXT_PUBLIC_, next.config env, assets Flutter ni --dart-define para secretos.
Flutter solo debe recibir la URL publica de la API; no las credenciales de Atlas.

El modulo env.ts solo carga configuracion; no implementa autenticacion ni endpoints.
Los permisos del usuario Atlas deben limitarse a trucks_db desde Atlas;
esta tarea no modifica usuarios ni infraestructura remota.

## Comprobar conexión a Atlas

Desde administrador ejecutar `npm run db:check`. El comando carga .env.local,
abre una conexión con el driver oficial, envia ping y cierra la conexión.
No modifica datos ni imprime credenciales. Un ping exitoso no demuestra permisos
de lectura/escritura ni que las colecciones esten creadas.

## Login temporal local

Ambas interfaces consumen POST /api/auth/login con JSON {username, password}.
Usuario de prueba: `prueba1`; contraseña: `123`. El archivo server/auth/test-users.json
contiene el usuario, el conductor vinculado (`driverId`) y un hash scrypt de la
contraseña. Nunca se sirve al cliente.
La respuesta contiene mode=test, datos publicos del usuario, `token` y `expiresAt`.
El token es un HMAC-SHA256 firmado con `AUTH_SECRET` (minimo 32 caracteres, solo en
.env.local), dura 12 horas e identifica al conductor; no hay renovacion.
El login se deshabilita fuera de NODE_ENV=development y en Vercel. No depende de Atlas.
Cuando llegue la integracion real, sustituir el proveedor de usuarios (coleccion
`users`) y agregar protecciones del login antes de producción.

## API de viajes del conductor

Todas las rutas requieren `Authorization: Bearer <token>`. El conductor se toma del
token, nunca del cuerpo. Fechas en ISO 8601 UTC. Errores: `{message}` en español.

| Ruta | Cuerpo | Respuesta |
| --- | --- | --- |
| POST /api/trips/start | `{qrCode, ping?}` | 201 viaje nuevo o 200 si ya estaba activo con ese camión: `{tripId, inicio, resumed, truck:{placa, modelo}}` |
| POST /api/trips/:id/ping | `{pings:[...]}` (1 a 100) | `{estado, accepted:[pingId], rejected:[{pingId, reason}], latest:{velocidad, timestamp}}` |
| POST /api/trips/:id/end | — | `{tripId, estado:'finalizado', fin}`; repetirlo devuelve el mismo `fin` |

Cada ping es `{pingId, latitude, longitude, accuracy, timestamp}`. `pingId` (8 a 100
caracteres `[A-Za-z0-9_-]`) debe conservarse al reintentar: el indice unico
`{tripId, pingId}` hace que un reenvio se confirme sin duplicar. Se guarda en
`locationPings` con `coords` GeoJSON `[longitud, latitud]` y `precision` en metros.

- `velocidad` se calcula en el servidor en km/h contra el ping anterior por
  `timestamp`; es `null` en el primer ping o si pasan menos de 1 s, y `0` si el
  desplazamiento es menor que la precision GPS.
- Un camion solo admite un viaje activo (indice parcial unico): 409 si esta ocupado.
  Un conductor con viaje activo en otro camion recibe 409.
- Tras el cierre se aceptan pings con `timestamp <= fin`; los posteriores vuelven
  en `rejected` con `trip_closed`.
- Codigos: 400 datos invalidos (no reintentar), 401 token ausente/vencido,
  404 QR o viaje inexistente, 409 conflicto, 503 base de datos no disponible.
