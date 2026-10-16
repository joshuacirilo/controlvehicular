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

## Autenticacion del panel administrador

El panel usa POST /api/auth/admin/login con JSON {username, password}; `username`
acepta el usuario o el email, sin distinguir mayusculas. Valida contra la coleccion
`users` (`rol: 'administrador'`, `activo: true`) con hash `scrypt$<salt>$<hash>`
(server/auth/password.ts). Responde `{user:{id, username, nombre, email}}` y guarda
la sesion en la cookie `cv_admin` (HttpOnly, SameSite=Lax, Secure en produccion,
8 horas). El token nunca llega al JavaScript del navegador.

- 5 intentos fallidos bloquean la cuenta 15 minutos (429). Errores genericos (401).
- POST /api/auth/admin/logout borra la cookie (204).
- Login, logout y toda mutacion autenticada por cookie exigen mismo origen
  (`Sec-Fetch-Site` u `Origin`); si no, 403. Estas rutas no envian cabeceras CORS.
- `proxy.ts` redirige a `/` las vistas del panel sin cookie valida (solo firma y
  expiracion). El layout `app/(panel)` y cada endpoint vuelven a autorizar.
- Nuevos endpoints de administracion: envolver el handler con
  `handleAdminRequest` (server/auth/admin.ts). Comprueba en Atlas que el usuario
  siga activo en cada peticion, asi desactivarlo corta su acceso al instante.
- Un token de conductor no sirve en el panel ni uno de administrador en la API de
  viajes: el rol forma parte del token firmado.

Crear un administrador (escribe en Atlas; la contrasena se pide sin eco o se lee
de `ADMIN_PASSWORD`, minimo 12 caracteres, y nunca se imprime):

```powershell
npm.cmd run admin:create -- --username admin1 --nombre "Nombre" [--email correo@dominio.com]
```

El validador de `users` exige `email`; si no se indica, se usa
`<username>@controlvehicular.local`. `username`, `nombre`, `failedLogins`,
`lockedUntil` y `lastLoginAt` son campos adicionales permitidos por el validador.
No hay indice unico sobre `username`: el script comprueba duplicados antes de
insertar. Pedir al DBA un indice unico si se crean cuentas desde la API.

## Login de la app movil

El login es obligatorio y solo por usuario: ese usuario es el piloto del viaje.
POST /api/auth/login `{username, password}` (usuario o email) valida contra `users`
con `rol: 'conductor'` y el conductor activo cuyo `drivers.userId` apunta a ese
usuario (403 si no hay). Devuelve `{user:{name}, token, expiresAt}` con un token
HMAC-SHA256 firmado con `AUTH_SECRET` (minimo 32 caracteres, solo en .env.local)
que dura 12 horas, sin renovacion. 5 intentos fallidos bloquean la cuenta 15
minutos: 429. La app permite escribir las credenciales o leerlas de un QR con
`Usuario:` y `Contraseña:`.

En desarrollo local (no Vercel) tambien acepta el usuario de prueba `prueba1` /
`123` de server/auth/test-users.json, vinculado a "Conductor Demo Uno".

No hay sesion de camion. El QR de cada camion contiene dos lineas: `Placa: <placa>`
y `Contraseña: <clave>` (tambien JSON `{"placa", "password"}`) y es **obligatorio
para iniciar cada viaje**. El servidor valida `trucks.passwordHash`; 5 claves
erroneas bloquean el camion 15 minutos. Quien vea el QR obtiene la clave:
protegerlo fisicamente y cambiar la clave si se expone.

Crear un camion (escribe en Atlas; clave desde `TRUCK_PASSWORD` o pedida sin eco,
minimo 8 caracteres). La placa se guarda en mayusculas y `qrCode` como `TRUCK-<placa>`:

```powershell
npm.cmd run truck:create -- --placa PRUEBA123 --modelo "Modelo"
```

## API de viajes del conductor

Todas las rutas requieren `Authorization: Bearer <token>`. El conductor se toma del
token, nunca del cuerpo. Errores: `{message}` en español.

Fechas: la app envia ISO 8601 con cualquier zona. En `trips` y `locationPings` se
guardan en hora de Guatemala (UTC-6, sin horario de verano): Atlas muestra la hora
local de Guatemala aunque la etiquete con `Z`, porque un campo fecha de MongoDB no
guarda zona horaria. Las respuestas de la API usan el sufijo `-06:00`. Quien lea
estos campos directamente debe tratarlos como hora de Guatemala, no como UTC.

| Ruta | Cuerpo | Respuesta |
| --- | --- | --- |
| POST /api/trips/start | `{placa, password, ping?}` del QR del camion (obligatorio) | 201 viaje nuevo o 200 si ya estaba activo con ese camión: `{tripId, inicio, resumed, truck:{placa, modelo}}` |
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
- Un conductor solo puede enviar pings y cerrar sus propios viajes.
- Codigos: 400 datos invalidos o falta el QR del camion (no reintentar), 401 token
  ausente/vencido, 403 QR del camion invalido o conductor inactivo,
  404 viaje inexistente, 409 conflicto, 429 camion bloqueado por intentos fallidos,
  503 base de datos no disponible.

## Flota en vivo (panel)

GET /api/trucks/live (cookie `cv_admin`, `Cache-Control: no-store`) devuelve los
viajes activos con su ultima posicion:

```text
{"trucks":[{"tripId","truckId","placa","modelo","conductor","inicio",
  "ubicacion":{"lat","lng","velocidad","precision","timestamp"} | null}]}
```

`ubicacion` es `null` hasta que llega el primer ping. Las fechas llevan `-06:00`.
La vista `/mapa` consulta esta ruta cada 5 s mientras la pestaña esta visible y
muestra en gris los camiones cuyo ultimo ping tiene mas de 60 s.
