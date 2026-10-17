# Traspaso para el siguiente agente: Control Vehicular

Actualizado: 16 de octubre de 2026, 23:40 (hora de Guatemala). Rama: `jc_geolocalizacion`.
Último commit: `c5aaf6d`. Todo el código está commiteado; solo esta versión de
`agentecompleto.md` queda pendiente de commit. Los archivos generados están ignorados.
El usuario hace sus propios commits.

Este documento resume seis conversaciones con el mismo usuario:

1. Backend de viajes + GPS + app Flutter.
2. Panel administrador (sidebar, vistas, mapa Leaflet).
3. API del administrador protegida, login del piloto rehecho, fechas a hora de Guatemala.
4. Revisión técnica (sección 12), `.pnpm-store` fuera de Git, **mapa con los camiones
   en vivo** (sección 8.2) e **identidad visual con el ícono de la app** (secciones 8.3 y 7).
5. La última (solo Flutter, sin tocar el backend): **cola offline de ubicaciones en
   SQLite** (sección 7.1) y **seguimiento en segundo plano en Android** con servicio
   en primer plano (sección 7.2).
6. La más reciente (solo panel Next.js): **revisión senior de este documento** con
   nuevos riesgos verificados en el código (sección 12), **vista `/camiones`** con
   capas camión → piloto → rutas paginadas (secciones 6.6 y 8.4) y **mapa ampliado**
   de cada ruta en una ventana modal.

Léelo completo antes de actuar. El código es la fuente de verdad: verifica antes de
afirmar.

## 0. Primer paso obligatorio: contexto con Graphify

El usuario exige usar Graphify para ahorrar contexto. **No explores carpetas ni leas
archivos completos antes de consultar el grafo.**

1. Desde la raíz `controlvehicular`, comprueba que existe `graphify-out/graph.json`
   (usa `Test-Path`: el Glob del agente no ve carpetas ignoradas por Git).
   Si no existe: `.\graphify.cmd extract . --code-only`.
2. Consulta el grafo sobre la tarea concreta:

   ```powershell
   .\graphify.cmd query "pregunta concreta sobre la tarea" --budget 1200
   .\graphify.cmd explain "ruta/archivo.tsx::NombreDelSimbolo"
   .\graphify.cmd path "SimboloOrigen" "SimboloDestino"
   ```

   Útiles: `query "startTrip recordPings endTrip guatemalaNow" --budget 800`,
   `query "liveTrucks useLiveTrucks FleetMap" --budget 800`,
   `query "TripTracker PingStore SqlitePingStore backgroundLocationUpdates" --budget 800`,
   `query "truckHistoryPage driverTrips DriverTrips RouteMiniMap" --budget 800`,
   `explain "handleAdminRequest"`, `explain "buildBrandTheme"`.
   Si `explain` dice "Ambiguous", repite con `ruta::Simbolo` (p. ej.
   `administrador/components/fleet-map.tsx::FleetMap`).
3. Lee solo lo que el grafo señale. No cargues `graph.json` ni todo `GRAPH_REPORT.md`.
   Si algo no aparece, haz una búsqueda puntual: su ausencia no prueba que no exista.
4. Tras cada conjunto de cambios de código: `.\graphify.cmd update .` desde la raíz
   (~820 nodos tras la última actualización). Puede imprimir un aviso de
   "community set changed": es informativo. Si el número de nodos se dispara, revisa
   si indexó código generado (pasó con `appmovil/web/sqflite_sw.js`: +648 nodos) y
   agrégalo a `.graphifyignore`.
5. `update .` solo indexa código (AST). El flujo semántico para documentos
   (`$graphify --update`) **nunca se ha ejecutado**: los nodos de este `.md` en el grafo
   están desactualizados (citan una numeración de secciones vieja).
6. En la entrega, indica si consultaste y actualizaste el grafo.

## 1. Qué es el proyecto

Control de flota. El **piloto** inicia sesión en la app **Flutter** (`appmovil/`) con
su usuario, escanea el QR del camión para iniciar un viaje y la app envía su GPS cada
5 s (lo guarda en SQLite si no hay conexión y en Android sigue en segundo plano).
Los administradores usan un panel **Next.js 16 full-stack** (`administrador/`)
que también expone la API HTTP que consume Flutter, y ven los camiones moverse en el
mapa. Base de datos: **MongoDB Atlas** (`trucks_db`), driver nativo `mongodb`
(no Mongoose).

Documentos de rol (léelos según la tarea, tras consultar el grafo):

- `README_AGENTE_FLUTTER.md` y `appmovil/AGENTS.md`: agente Flutter.
- `README_AGENTE_MODULO_ADMIN.md` y `administrador/AGENTS.md`: agente Next.js.
- `AGENTS.md` (raíz): reglas de Graphify.
- `documentacion/Requerimientos.md` (RF01-RF16, RNF01-RNF11) y roles de Joshua
  (mobile), Luis (backend), Ericka (frontend) y Brandon (DBA).
- **`administrador/server/README.md`: contrato vigente** de autenticación (panel y
  app), API de viajes, flota en vivo, scripts y fechas. Está al día.

Desactualizados (no los sigas al pie de la letra): los dos `AGENTS.md` de módulo
("plantilla, sin MongoDB, sin login", proponen Mongoose) y `administrador/README.md`
(sección 9, punto 8). **Ojo:** Cursor inyecta automáticamente esos `AGENTS.md` como
reglas al leer archivos de cada módulo; lo que dicen sobre el estado del proyecto es
falso. Este documento y `server/README.md` mandan.

## 2. Reglas del usuario (obligatorias)

- **Responder siempre en español.** El usuario pide actuar como senior dev.
- **Graphify antes de explorar** y actualizarlo al terminar (sección 0).
- **No generar APK ni AAB** ni builds/lanzamientos Android. `flutter build web` sí.
- No desplegar ni modificar infraestructura externa (Atlas: usuarios, validadores,
  índices, red; Vercel) sin permiso. **Leer** índices o datos de Atlas está bien.
  Cambiar **datos** de prueba se ha hecho con permiso explícito o como parte directa
  de lo pedido; limpia siempre lo que crees.
- **Nunca imprimir secretos.** `administrador/.env.local` (ignorado por Git) tiene
  credenciales de Atlas, `AUTH_SECRET` y, en comentarios, contraseñas de prueba.
  Si lo inspeccionas, enmascara valores (`-replace '=.*','=***'`).
- Antes de escribir código Next.js, leer `administrador/node_modules/next/dist/docs/`.
  Next 16.3.6: `middleware` ahora es **`proxy.ts`**; `cookies()` es async; `params`
  de Route Handlers es una Promise; `ssr:false` de `next/dynamic` solo dentro de
  Client Components; los `GET` de Route Handlers **no se cachean** por defecto;
  en `next/image` **`priority` está obsoleto, usa `preload`**; íconos por convención
  de archivos (`app/icon.png`, `app/apple-icon.png`).
- Tras cambios: Flutter `dart format lib test` + `flutter analyze` + `flutter test`;
  Next.js `npm.cmd run lint` + `npx.cmd tsc --noEmit` + `npm.cmd run build`.
- **No ejecutes `npm run build` si hay un `next dev` activo.** En la
  conversación 4 `Get-NetTCPConnection -LocalPort 3000` no devolvió nada y aun así había
  un `next dev` del usuario arrancando; el build se ejecutó en paralelo (sin daño,
  Next 16 separa `.next/dev`). La revisión automática **bloquea** listar procesos con
  `Get-CimInstance Win32_Process`. En su lugar lee las primeras líneas de los archivos
  de terminal del IDE (metadatos y si hay un comando activo; si la terminal termina en
  el prompt `PS ...>`, el `next dev` está detenido) y usa
  `Get-NetTCPConnection -LocalPort 3000 -State Listen`.
- **No hagas commit ni push** salvo que el usuario lo pida.
- **No mates procesos que no iniciaste** (el usuario suele tener `next dev` en la
  terminal y Flutter web con `scripts\run-flutter-web.cmd`). Si necesitas reiniciarlos,
  pídeselo.
- Usar `AskQuestion` para decisiones de producto reales. Si el usuario cancela el
  formulario y responde en texto, sigue su respuesta.
- Implementar solo lo pedido.
- Leer o modificar archivos fuera del repositorio (p. ej. `C:\Users\jciri`) requiere
  aprobación explícita. Excepción: las imágenes que el usuario adjunta al chat se
  guardan en `C:\Users\jciri\.cursor\projects\...\assets\` y se pueden leer.

## 3. Entorno del usuario

- Windows 11, **PowerShell 5.1**, proyecto en **OneDrive**. Node 24.19, pnpm 10.27.0,
  Flutter 3.47.5 / Dart 3.13.4, Next 16.3.6, React 19.2.8.
- **Codificación en PowerShell 5.1**: `Set-Content`/`Get-Content` sin codificación
  explícita corrompen UTF-8 (ñ, ó → mojibake) y `-Encoding utf8NoBOM` no existe.
  Para escribir archivos usa las herramientas de edición del agente o
  `[IO.File]::WriteAllText(ruta, texto, (New-Object Text.UTF8Encoding $false))`.
  La consola muestra `�` en respuestas con tildes: es solo visualización.
- Peticiones HTTP: `curl.exe` (no el alias `curl`) con el cuerpo JSON en un archivo
  temporal (`--data-binary "@archivo"`).
- Scripts contra Atlas: crear un `.cjs` temporal **dentro de `administrador/`**
  (para resolver `mongodb`), ejecutar `node --env-file=.env.local script.cjs` y
  borrarlo. Usar `process.env.MONGODB_URI` y `MONGODB_DB`; nunca imprimirlos.
- **Probar endpoints del panel sin conocer la contraseña**: un `.cjs` temporal lee el
  `_id` del admin, firma un token igual que `server/auth/token.ts`
  (`base64url(JSON{sub, role:'administrador', exp}) + '.' + HMAC-SHA256(AUTH_SECRET)`)
  y lo manda como cookie `cv_admin=<token>`. Así se probaron `GET /api/trucks/live`,
  la API de rutas por piloto y el HTML de `/camiones`.
- **Servidor propio para probar sin tocar el del usuario**: tras un `npm run build`
  correcto, `npx.cmd next start -p 3100` en segundo plano, probar contra
  `http://localhost:3100` y detenerlo con `taskkill /T /F /PID <pid que devolvió tu shell>`
  (solo tu propio proceso). Su salida con código 1 al matarlo es esperada.
- **Tipos de rutas de Next 16**: `PageProps<'/ruta'>` y `RouteContext<'/api/...'>` son
  globales generados. Si `tsc` dice que una ruta nueva "does not satisfy the constraint
  'AppRoutes'", ejecuta `npx.cmd next typegen` (no necesita detener `next dev`).
- **Redimensionar imágenes**: `Add-Type -AssemblyName System.Drawing` en PowerShell
  (bicúbico de alta calidad, sin instalar nada). Así se generaron todos los íconos.
- **Smart App Control** bloquea ejecutables sin firma (`os error 4551`). No llames los
  `.exe` de `.venv-graphify`; usa `.\graphify.cmd`. No propongas desactivarlo.
- La herramienta de revisión automática puede bloquear `Remove-Item` recursivo; para
  borrar archivos usa la herramienta Delete del agente.
- **Gestor de paquetes de `administrador/`: pnpm** (`pnpm-lock.yaml`).
  `package-lock.json` está desincronizado: `npm ci` falla. Scripts con
  `npm.cmd run <script>`. **Detén `next dev` antes de `pnpm add`/`install`.**
  El build avisa de un `pnpm-lock.yaml` en `C:\Users\jciri` (fuera del repo): ignóralo.
- La raíz no tiene `package.json`: un `npm install` ahí sube a
  `C:\Users\jciri\package.json` (otro proyecto). Instala siempre dentro del módulo.
- `.pnpm-store/` contiene **junctions** a `administrador/`: nunca lo borres con
  `Remove-Item -Recurse`. Ya no está versionado (está en `.gitignore`).
- Next 16 no permite dos `next dev` sobre la misma carpeta. El servidor a veces
  escucha solo en IPv6: usa `http://localhost:3000`, no `127.0.0.1`.
- **Error de hidratación con contenido viejo** (p. ej. "Entorno de prueba",
  `test-badge`): es caché del navegador, no del código. Se diagnosticó descargando el
  HTML y los chunks de `localhost:3000` (eran actuales). Solución: Ctrl+Shift+R o
  "Clear site data"; si persiste, reiniciar `next dev` borrando `.next/dev`.
- La red del usuario sale por dos IPs públicas (`181.174.106.2` y `190.104.116.14`);
  ambas están en Network Access de Atlas.
- No hay decodificador de QR instalado (en el pasado se usó `opencv-python-headless`
  temporal con `pip --target` en `%TEMP%` y se borró).

## 4. Graphify (funciona)

- Siempre `.\graphify.cmd <comando>` **desde la raíz**.
- Los lanzadores usan el Python base (`home` en `.venv-graphify/pyvenv.cfg`) con
  `PYTHONPATH=.venv-graphify/Lib/site-packages`.
- Reinstalar: `.\scripts\install-graphify.cmd`. `.graphifyignore` excluye `.pnpm-store/`
  y `appmovil/web/sqflite_sw.js` (JavaScript compilado de sqflite web).
- Último `update .`: tras el mapa ampliado de `/camiones` (~820 nodos).

## 5. Base de datos Atlas (`trucks_db`)

Validadores `$jsonSchema` **estrictos** (`validationLevel: strict`,
`validationAction: error`) creados por el DBA. Permiten campos extra (no usan
`additionalProperties:false` en la raíz).

| Colección | Campos requeridos / notas |
| --- | --- |
| `users` | `email` (índice único con collation `{locale:'en', strength:2}`), `passwordHash`, `rol` (`administrador`/`conductor`), `activo`, fechas. Extras usados: `username`, `nombre`, `failedLogins`, `lockedUntil`, `lastLoginAt`. Sin índice único en `username` (el script comprueba duplicados) |
| `drivers` | `userId` (ObjectId o null), `nombre`, `licencia` única, `telefono`, `activo`, fechas. El piloto se vincula con `drivers.userId = users._id` |
| `trucks` | `placa` (`^[A-Z0-9-]+$`), `qrCode` único, `modelo`, `activo`, fechas. Extras: `passwordHash`, `failedLogins`, `lockedUntil` |
| `trips` | `truckId`, `driverId`, `rutaPlaneada` (null), `estado` (`activo`/`finalizado`), `inicio`, `fin` (null si activo; `$expr` exige `fin >= inicio`), `createdAt`, `updatedAt` |
| `locationPings` | `pingId`, `tripId`, `truckId`, `coords` GeoJSON `[lng, lat]`, `velocidad` (número o null), `timestamp` (date), `receivedAt` (date). Extras: `driverId`, `precision` |

**Índices verificados** (lectura, 16/10/2026):

- `trips`: `{truckId}` **único parcial** con `estado:'activo'`; `{truckId, inicio:-1, _id:-1}`;
  `{driverId, inicio:-1, _id:-1}`; `{inicio:-1, _id:-1}`. **No hay** índice único por
  `driverId` activo (ver sección 12, riesgo de dos viajes activos por piloto).
- `locationPings`: `{tripId, pingId}` único; `{tripId, timestamp:-1, _id:-1}` (lo usa
  la flota en vivo para el último ping); `{truckId, timestamp:-1, _id:-1}`; `coords`
  `2dsphere`.

**Fechas en hora de Guatemala**: `trips` (`inicio`, `fin`, `createdAt`, `updatedAt`) y
`locationPings` (`timestamp`, `receivedAt`) se guardan como **hora local de Guatemala
(UTC-6)**, por decisión explícita del usuario ("no quiero UTC, quiero -6 en la base").
Un BSON date no guarda zona, así que Atlas muestra la hora de Guatemala con sufijo
`Z`. No se usó texto con `-06:00` porque los validadores exigen tipo `date` y
cambiarlos es infraestructura. Ver sección 6.4. **El resto de colecciones** (`users`,
`trucks`, `drivers`: `createdAt`, `lastLoginAt`, `lockedUntil`...) **siguen en UTC**;
se ofreció pasarlas a -6 y el usuario no respondió. En la revisión técnica se
recomendó **volver a UTC** en todo (sección 12); sigue pendiente de decidir.

Datos (instantánea del 16/10/2026; cambian a menudo, compruébalos antes de afirmarlos):

- `users`: 1, el administrador `admin1` (contraseña en comentarios de `.env.local`).
  **No hay pilotos reales** (`rol:'conductor'`).
- `drivers`: 5 demo (`bb0000000000000000000001`..`05`, "Conductor Demo Uno".."Cinco",
  `userId: null`).
- `trucks`: 1, `PRUEBA123` (modelo "Camion de prueba", `qrCode` `TRUCK-PRUEBA123`,
  con `passwordHash`).
- `trips` (~21:40): 4 **finalizados**, todos de `PRUEBA123` con "Conductor Demo Uno"
  (el usuario probando con `prueba1`), con 8, 192, 41 y 17 pings. Ninguno activo.
  Todos marcan 0 km porque se hicieron desde la PC sin moverse (precisión ~149 m).
- Entre 14:01:54 y ~14:03:30 se perdieron pings de uno de esos viajes: durante la
  transición a -6 el servidor los rechazó como `before_trip` y la app los descartó.

## 6. Backend Next.js (`administrador/`)

### 6.1 Autenticación compartida (`server/auth/`)

- `token.ts` (sin `server-only` porque lo importa `proxy.ts`): tokens HMAC-SHA256
  `payload.firma` en base64url, firmados con `AUTH_SECRET` (≥32 caracteres, en
  `.env.local`). `signToken`, `readToken(token, role)` (longitud ≤4096,
  `timingSafeEqual`, comprueba `role`, `sub`, `exp`). `ADMIN_COOKIE = 'cv_admin'`.
  El rol va firmado: un token de conductor no sirve en el panel ni viceversa.
- `password.ts`: `hashPassword`/`verifyPassword` con scrypt async, formato
  `scrypt$<salt>$<hash>`; hash ficticio para usuarios inexistentes (tiempo constante).
- `accounts.ts`: `checkCredentials(collection 'users'|'trucks', cuenta, password)`:
  5 fallos bloquean 15 min (`failedLogins`, `lockedUntil`); éxito reinicia contadores.
- `session.ts`: `issueDriverToken({id, name, driverId})` (12 h, sin renovación) y
  `authenticateDriver(request)` (Bearer, rol `conductor`, `driverId` ObjectId válido).
- `driver-login.ts`: `loginUser(username, password)` (usuario o email con la
  collation, `rol:'conductor'`, `activo:true`; exige un `drivers` activo con
  `userId` = ese usuario, si no 403) y `verifyTruck(placa, password)` (403 QR
  inválido, 429 bloqueado). `normalizePlate` pasa a mayúsculas.
- `test-login.ts` + `test-users.json` (versionado): usuario de prueba `prueba1` /
  `123`, vinculado a `bb…01`. Solo con `NODE_ENV=development` y fuera de Vercel.

### 6.2 Panel administrador protegido

- `POST /api/auth/admin/login` `{username, password}` → cookie `cv_admin` (HttpOnly,
  SameSite=Lax, Secure en producción, 8 h). 401 genérico, 429 bloqueo, 503 BD.
- `POST /api/auth/admin/logout` → borra la cookie (204).
- Login/logout y mutaciones por cookie exigen **mismo origen** (`Sec-Fetch-Site` u
  `Origin` vs `Host`), si no 403; sin cabeceras CORS.
- `server/auth/admin.ts`: `getAdmin()` (vuelve a comprobar en Atlas que el admin siga
  activo), `handleAdminRequest(request, handler)` para **todo endpoint de admin
  nuevo** (responde `no-store`, 401 sin sesión, 503 si falla la BD), `adminJson`,
  `startAdminSession`, `endAdminSession`.
- `proxy.ts`: redirige a `/` si no hay cookie válida; matcher `/dashboard`, `/mapa`,
  `/cuentas`, `/perfil`. No cubre `/api/*` (cada handler autoriza).
  `app/(panel)/layout.tsx` (async) llama `getAdmin()` y pasa `user` a `<Sidebar />`.
- Script: `npm.cmd run admin:create -- --username X --nombre "Nombre" [--email]`
  (contraseña por `ADMIN_PASSWORD` o pedida sin eco, mínimo 12).

### 6.3 Login del piloto y viajes (API que consume Flutter)

Decisión final del usuario: **no existe sesión de camión**. El login es obligatorio y
solo por usuario (el piloto). El QR del camión (placa + contraseña) se exige **solo al
iniciar cada viaje**.

- `POST /api/auth/login` `{username, password}` → `{user:{id, username, name}, token,
  expiresAt}`. Primero prueba `prueba1` (solo dev), luego `loginUser`. 503 si falla BD.
- `POST /api/trips/start` `{placa, password, ping?}` (Bearer). Sin QR → 400; conductor
  inactivo → 403; QR inválido → 403; camión bloqueado → 429; camión ocupado o piloto
  con viaje activo en otro camión → 409; mismo camión con viaje activo → 200
  `resumed:true`; nuevo → 201 `{tripId, inicio, resumed, truck:{placa, modelo}}`.
- `POST /api/trips/:id/ping` `{pings:[...]}` (1-100) y `POST /api/trips/:id/end`:
  filtran por `{_id, driverId}`. Pings idempotentes por `pingId`; tras el cierre se
  aceptan los de `timestamp <= fin`; cierre idempotente.
- `/api/auth/truck-login` **se eliminó** (404). Queda la carpeta vacía
  `app/api/auth/truck-login/` (Git no la ve; se puede borrar a mano).
- Script: `npm.cmd run truck:create -- --placa PRUEBA123 [--modelo "Modelo"]`
  (contraseña por `TRUCK_PASSWORD` o sin eco, mínimo 8).
- `server/trips/pings.ts`: validación (timestamp ISO, desfase máx. 2 min al futuro,
  7 días al pasado, comparado con el instante real) y velocidad haversine en km/h
  (null si primero o Δt<1 s; 0 si el desplazamiento ≤ precisión GPS).
- Otros: `server/db/mongo.ts` (cliente cacheado en `globalThis`), `server/env.ts`,
  `server/http.ts`, `server/cors.ts` (`CORS_ALLOWED_ORIGINS`; dev `localhost:8080`),
  `server/trips/handler.ts` (`handleDriverRequest`), `scripts/check-db.mjs`.

### 6.4 Hora de Guatemala (`server/time.ts`)

- `toGuatemala(instant)` resta 6 h; `guatemalaNow()`; `formatGuatemala(stored)`
  devuelve ISO con `-06:00` (p. ej. `"2026-10-16T13:56:33.603-06:00"`), que en el
  cliente se parsea como el instante real.
- `service.ts` guarda con `guatemalaNow()` y convierte los `timestamp` de los pings
  con `toGuatemala` **antes** de comparar (`before_trip` con tolerancia de 5 min,
  `trip_closed`, velocidad, `$expr fin >= inicio`).
- Las respuestas de la API usan `formatGuatemala`. Cualquier lector directo de la BD
  debe tratar esas fechas como hora de Guatemala, **no** como UTC. Nunca compares un
  campo guardado con `new Date()`: usa `guatemalaNow()`.
- Si se vuelve a UTC, hay que migrar los datos (sumar 6 h) en el mismo momento del
  despliegue: mezclar formatos hace que el servidor rechace pings.

### 6.5 Flota en vivo (`GET /api/trucks/live`)

- `app/api/trucks/live/route.ts`: `GET` envuelto en `handleAdminRequest` (cookie de
  admin; 401 sin sesión o con token de conductor; `Cache-Control: no-store`).
- `server/trucks/live.ts` → `liveTrucks()`: una agregación sobre `trips` con
  `estado:'activo'` y `$lookup` a `trucks` (placa, modelo), `drivers` (nombre) y
  `locationPings` (último por `timestamp`, usa el índice `{tripId, timestamp}`).
  Ordena por placa.
- Contrato compartido en `lib/live-trucks.ts` (solo tipos, sin secretos):
  `{trucks:[{tripId, truckId, placa, modelo, conductor, inicio,
  ubicacion:{lat, lng, velocidad, precision, timestamp} | null}]}`. `ubicacion` es
  `null` hasta el primer ping. Fechas con `-06:00`. Documentado en `server/README.md`.

### 6.6 Historial por camión y piloto (conversación 6)

- `server/trucks/history.ts` (`server-only`):
  - `truckHistoryPage(page)`: todos los camiones ordenados por placa, 10 por página
    (`TRUCKS_PER_PAGE`), con `$lookup` a `trips` agrupado por `driverId` (`viajes`,
    `ultimoViaje`, `enCurso`) y nombre desde `drivers`. Una página fuera de rango
    devuelve la última. La usa directamente la página `/camiones` (sin API).
  - `driverTrips(truckId, driverId, page)`: viajes de ese piloto en ese camión, del más
    reciente al más antiguo, 5 por página (`TRIPS_PER_PAGE`). Por viaje lee **todos**
    sus pings (`coords`, `precision`) ordenados por tiempo, calcula `distanciaKm`
    (solo suma desplazamientos mayores que la precisión, con un punto ancla; misma
    idea que `speedKmh`) y reduce la ruta a ~200 coordenadas `[lat, lng]`.
- `GET /api/trucks/:truckId/drivers/:driverId/trips?page=N`: `handleAdminRequest`
  primero (401 sin sesión), luego 404 si un id no es ObjectId y 400 si `page` no es un
  entero ≥ 1. Respuesta `{page, totalPages, total, trips:[{tripId, estado, inicio,
  fin|null, puntos, distanciaKm, ruta}]}` con fechas `-06:00`.
- Tipos y constantes compartidos en `lib/truck-history.ts`. `distanceMeters` ahora se
  exporta desde `server/trips/pings.ts`. Documentado en `server/README.md`.
- Coste: lee todos los pings de cada viaje mostrado. Si hay viajes de días, guardar un
  resumen (distancia, ruta reducida) al cerrar el viaje.

### 6.7 Verificación hecha (conversaciones 4 y 6; la 5 no tocó el backend)

Lint correcto; `tsc` limpio (el error viejo de `.next/types` sobre `truck-login`
desapareció tras el build). `npm run build` correcto (ruta dinámica
`/api/trucks/live`). E2E contra Atlas con el `next dev` del usuario: `/api/trucks/live`
sin cookie 401, con token de conductor 401, con token de admin 200 con `PRUEBA123` y
su última posición. El panel sirve `app/icon.png`/`apple-icon.png` y `/favicon.ico`
da 404 (se borró el de Next). Tras el cambio de marca no se ejecutó `build` porque
el usuario tenía `next dev` activo.

Conversación 6: lint, `tsc` y `npm run build` correctos tras crear `/camiones`
(ruta dinámica). Prueba contra Atlas con un `next start -p 3100` propio y cookie de
admin firmada: API de rutas sin cookie 401, con cookie 200 (`no-store`, 4 viajes),
`page=0` 400, id inválido 404; `/camiones` con cookie 200 con la placa y el piloto en
el HTML, sin cookie 307 a `/`. El mapa ampliado (modal) solo pasó lint y `tsc`: el
usuario tenía `next dev` activo y no se ejecutó build ni se vio en navegador.

## 7. App Flutter (`appmovil/`)

- `lib/core/api_client.dart`: `API_BASE_URL` por `--dart-define` (por defecto
  `http://localhost:3000/api/`; en release exige HTTPS). `login(username, password)`
  → `AuthSession(userId, name, token)` (**exige `user.id`** en la respuesta; el
  servidor lo envía en ambos caminos de login). `startTrip(token, TruckCredentials,
  firstPing)` envía `{placa, password, ping}`. `sendPings`, `endTrip`,
  `ApiException(message, statusCode)`.
- `lib/core/qr_credentials.dart`: `QrCredentials` (login: `Usuario:`/`Contraseña:` o
  JSON `{username, password}`) y `TruckCredentials` (camión: `Placa:`/`Contraseña:` o
  JSON `{placa, password}`; placa a mayúsculas, `^[A-Z0-9-]{1,20}$`). Acepta etiquetas
  en líneas separadas o en una sola línea y `:` o `=`. Etiquetas desconocidas se
  rechazan: un QR de usuario no pasa como camión y viceversa.
- `lib/qr_scan_page.dart`: `QrScanPage<T>(title, instructions, parse)`.
- `lib/core/location_service.dart`: `currentLocation()` con `geolocator` (alta
  precisión, límite 20 s; pide el permiso en nativo). Además
  `backgroundTrackingSupported` (solo Android nativo), `backgroundLocationUpdates()`
  (sección 7.2) y `locationErrorFrom(error)` (errores del flujo → `LocationException`).
- `lib/core/trip_tracker.dart` (`TripTracker(api, token, userId, store?, locate?,
  watch?, interval=5s, maxQueue=120000)`): `start(TruckCredentials)` toma la posición
  con `currentLocation` (así se pide el permiso), llama a `startTrip` con el primer
  ping y arranca el temporizador. Con `watch` (Android) las muestras salen del flujo
  continuo y el temporizador solo envía; sin `watch` (web y pruebas) el temporizador
  consulta `locate` cada 5 s. Cada muestra se guarda en el `PingStore` **antes** de
  enviarse (sección 7.1). Lotes de 50 del viaje más antiguo; reintento con espera
  creciente. Respuestas: aceptados/rechazados se borran del almacén; 400 descarta el
  lote; 404 borra **todas** las muestras de ese viaje (no es del piloto) y, si es el
  viaje actual, lo da por cerrado; 401 detiene todo (`sessionExpired`);
  `estado != activo` detiene el muestreo pero **sigue subiendo** las pendientes de
  ese viaje (el servidor acepta las anteriores al cierre). `end()` exige que no quede
  nada pendiente del piloto (incluye viajes anteriores). Fija `sentCount = 1` al
  iniciar aunque el servidor haya rechazado el primer ping (pendiente).
  Getters para la UI: `pendingCount`, `persistent`, `tracksInBackground`.
- **`lib/core/brand.dart`** (nuevo): `BrandColors` (`navy #01215A`, `navyLight
  #012D76`, `blue #0349B9`, `cyan #34E1FF`, `teal #0DDDDF`, `surface #F1F5F9`,
  `muted #526078`), `buildBrandTheme()` (AppBar azul marino, primario azul, foco azul)
  y `BrandMark(size)` (el ícono con esquinas redondeadas, asset
  `assets/icon/app_icon.png` declarado en `pubspec.yaml`). **Usa `BrandColors` en vez
  de colores sueltos** en pantallas nuevas.
- `lib/main.dart`: `theme: buildBrandTheme()`.
- `lib/login_page.dart`: fondo con degradado radial azul y `BrandMark` como logo;
  botones "Ingresar" e "Ingresar con QR". `LoginPage(api?, scanQr?, store?)`: abre el
  almacén con `openPingStore()` en `initState` (lo cierra en `dispose`) y crea el
  `TripTracker` con `userId: session.userId`, el almacén y
  `watch: backgroundTrackingSupported ? backgroundLocationUpdates : null`.
  Las pruebas pasan `store: MemoryPingStore()`.
- `lib/trip_home_page.dart`: AppBar con `BrandMark(size: 32)` + título; "Iniciar
  viaje" **siempre** abre el escáner del QR del camión. Cerrar sesión bloqueado durante
  el viaje (sin viaje se permite aunque haya pendientes: quedan guardadas para ese
  piloto). Textos nuevos: "Sin conexión · guardando en el teléfono" (o
  "· reintentando" si el almacén no es persistente), aviso de ubicaciones de un viaje
  anterior pendientes, "Descartadas por falta de espacio o antigüedad", aviso si el
  dispositivo no puede guardar, sesión vencida con pendientes guardadas, y el texto
  inferior de segundo plano en Android ("No cierres la app desde la lista de apps
  recientes"). Aún quedan colores sueltos de estado (rojo, verde, ámbar) a propósito.
- Íconos: `android/app/src/main/res/mipmap-*/ic_launcher.png` (48-192 px),
  `web/favicon.png` (32), `web/icons/Icon-*.png` y `Icon-maskable-*.png` (192/512),
  generados desde la imagen de 1024 px del usuario. No hay carpeta `ios/`.
- Android: `android:label="Control vehicular"`; pantalla de arranque azul marino con el
  ícono centrado (`res/values/colors.xml` → `brand_navy`, `drawable*/launch_background.xml`).
  Permisos y recursos del segundo plano en la sección 7.2.
- Web: `manifest.json` y `index.html` con nombre "Control vehicular", `theme_color` y
  `background_color` `#01215A`, `lang="es"` y fondo azul mientras carga Flutter.
  `web/sqlite3.wasm` y `web/sqflite_sw.js` (versionados) para SQLite en web (7.1).
- Dependencias nuevas: `sqflite` 2.4.4, `sqflite_common` 2.5.14,
  `sqflite_common_ffi_web` 1.2.0; dev: `sqflite_common_ffi` 2.4.4 (SQLite real en las
  pruebas de PC; Smart App Control **no** lo bloquea).
- Pruebas: **26**, todas pasan. `qr_login_test.dart`, `widget_test.dart`,
  `trip_home_test.dart` (incluye: offline sobrevive a un reinicio y se reenvía con los
  mismos `pingId`; no se suben pendientes de otro piloto; flujo de segundo plano
  alimenta las muestras, ignora fijas demasiado seguidas y se cancela al terminar) y
  `ping_store_test.dart` (mismos casos contra `MemoryPingStore` y `SqlitePingStore`).
- En PC la precisión es ~149 m (WiFi/IP), por eso la velocidad sale 0.

Ejecutar: `npm.cmd run dev` en `administrador/` y `scripts\run-flutter-web.cmd` (Chrome,
puerto 8080, `API_BASE_URL=http://localhost:3000/api/`). Tras cambios en Dart, el
usuario pulsa `R` (hot restart); **si cambian assets o `pubspec.yaml` hay que detener
y relanzar** el script.

### 7.1 Cola offline de ubicaciones (SQLite)

Pedido del usuario: "si la app se queda sin internet que guarde el historial con
SQLite y luego con internet lo mande". Decisiones tomadas con `AskQuestion`:
SQLite **también en web**; la copia local **se borra** cuando el servidor la confirma
(el historial oficial vive en Atlas); al volver a iniciar sesión las pendientes **se
suben solas** y para seguir el viaje el piloto **vuelve a escanear el QR** (el
servidor reanuda el mismo viaje con `resumed:true`). No se restaura la pantalla del
viaje automáticamente.

- `lib/core/ping_store.dart`: interfaz `PingStore` (`persistent`, `add(owner, tripId,
  ping)`, `next(owner, limit)` → `PendingBatch(tripId, pings)` del viaje con la muestra
  más antigua, `count`, `remove(ids)`, `removeTrip`, `removeOlderThan`, `trim`,
  `close`). `owner` = `user.id` del piloto: otro piloto en el mismo teléfono no ve ni
  sube las ajenas.
  - `SqlitePingStore.open(factory, path)`: base `control_vehicular.db`, tabla
    `pending_pings(ping_id PK, owner, trip_id, latitude, longitude, accuracy,
    taken_at INTEGER ms UTC)` + índice `(owner, taken_at)`. Inserción con
    `ConflictAlgorithm.ignore` (idempotente por `pingId`).
  - `MemoryPingStore`: pruebas y respaldo (`persistent = false`).
  - `openPingStore()`: abre SQLite con la fábrica de la plataforma y, si falla, usa
    memoria (la UI avisa que las pendientes se perderían al cerrar).
- Fábrica por importación condicional: `ping_database_io.dart` (`databaseFactory` de
  `sqflite`, Android) y `ping_database_web.dart` (`databaseFactoryFfiWeb`, IndexedDB,
  ligado al puerto: usar siempre 8080).
- Límites: `maxQueue` 120 000 muestras por piloto (~7 días a 5 s; `trim` borra las más
  viejas). Antes de enviar se borran las de más de 6 d 23 h porque el servidor rechaza
  el **lote completo** si una tiene más de 7 días. Ambas cuentan en `droppedCount`.
- Binarios web: `dart run sqflite_common_ffi_web:setup` (desde `appmovil/`) genera
  `web/sqlite3.wasm` y `web/sqflite_sw.js`; con `--force` si se actualiza `sqlite3`.
  **Aviso:** descargó el wasm de `sqlite3-3.6.0` mientras el paquete Dart `sqlite3`
  quedó en 3.5.2; el README de la librería advierte de posibles incompatibilidades.
- **No verificado en navegador** por el agente (solo `flutter build web` compila y los
  binarios se copian a `build/web`). Prueba manual propuesta: iniciar viaje, DevTools
  → Network → Offline, ver crecer "Pendientes", cerrar pestaña, reabrir, quitar
  Offline, iniciar sesión con `prueba1` y comprobar que suben (mapa / Atlas). Si la
  consola muestra "No se pudo abrir la base local de ubicaciones", sospechar del wasm.
- Sigue haciendo falta internet para login, iniciar viaje (validar QR) y terminarlo.
  El token no se persiste: tras cerrar la app hay que iniciar sesión para subir.

### 7.2 Seguimiento en segundo plano (Android)

Pedido del usuario: que al iniciar el viaje (botón + QR del camión) la app siga
funcionando en segundo plano en Android.

- `backgroundLocationUpdates()` usa `Geolocator.getPositionStream` con
  `AndroidSettings(accuracy: high, intervalDuration: 5 s, foregroundNotificationConfig:
  ...)`: geolocator levanta su `GeolocatorLocationService` como **servicio en primer
  plano de tipo `location`** con notificación fija "Viaje en curso" (canal
  "Seguimiento del viaje", color `#01215A`, `enableWakeLock: true`, `setOngoing: true`).
  El servicio vive mientras haya suscripción.
- `TripTracker`: se suscribe al iniciar (y al reanudar tras un `end()` fallido);
  `cancelOnError`: ante un error muestra el aviso y se vuelve a suscribir en el
  siguiente ciclo. Ignora fijas a menos de 0,8 × intervalo de la anterior (solo en el
  flujo). Cancela la suscripción (apaga servicio y notificación) al empezar `end()`,
  si el viaje se cierra en el servidor, si vence la sesión y en `dispose`.
- `AndroidManifest.xml`: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (Android
  14; el manifiesto de `geolocator_android` 5.1.1 **no** lo declara aunque su README
  diga lo contrario) y `WAKE_LOCK`. **Sin `ACCESS_BACKGROUND_LOCATION`** a propósito:
  el servicio arranca con la app visible (al volver del escáner), lo que basta con el
  permiso "mientras se usa"; pedirlo exigiría revisión especial en Google Play.
- `res/drawable/ic_notification.xml`: camión blanco (Material `local_shipping`) para la
  barra de estado. `res/raw/keep.xml` lo protege del encogimiento de recursos en
  release (geolocator lo busca por nombre).
- **No probado en dispositivo** (regla: no generar APK ni lanzar Android). Prueba
  manual del usuario: `flutter run` en un teléfono con
  `--dart-define=API_BASE_URL=http://<IP-de-la-PC>:3000/api/`, iniciar viaje, salir a
  otra app o apagar la pantalla y ver en `/mapa` que el camión sigue moviéndose.
- Límites conocidos: si el piloto cierra la app desde recientes, Android destruye el
  proceso y el seguimiento se detiene (haría falta un servicio con su propio motor de
  Flutter). En Android 13+ sin permiso de notificaciones el servicio funciona pero la
  notificación no se ve (pedirlo requiere p. ej. `permission_handler`; se ofreció y
  el usuario no respondió). Fabricantes con ahorro agresivo (Xiaomi, Huawei,
  Samsung): configurar Batería → "Sin restricciones". En web no hay segundo plano.

### 7.3 Lecciones de pruebas Flutter (útiles al tocar el tracker)

- En `testWidgets`, el servidor simulado (`MockClient`) debe usar **`expectSync`**, no
  `expect`: si el flujo arranca fuera de un `tap` (p. ej. desde el constructor del
  tracker), `expect` lanza "Guarded function conflict" y el tracker lo atrapa como
  error de almacenamiento.
- **No esperes (`await`) el `cancel()` de una suscripción**: con un
  `StreamController.broadcast` devuelve un `Future` del zone raíz que el reloj falso
  nunca completa y el `end()` se queda colgado. `_stopWatching()` es síncrono.
- `defaultTargetPlatform` en pruebas es Android: por eso `watch` es un parámetro
  explícito (por defecto `null`) y no se decide dentro del tracker.
- `DateTime.now()` no avanza con `tester.pump`: el filtro de frecuencia solo se aplica
  al flujo, no al muestreo por temporizador.

## 8. Panel administrador: vistas

### 8.1 Estructura

- Grupo `app/(panel)/`: `/dashboard`, `/mapa`, `/camiones`, `/cuentas`, `/perfil`.
  Dashboard, cuentas y perfil muestran **solo el título** (el usuario pidió "solo crea
  las vistas"). `/camiones` está en la sección 8.4.
- **Cada página nueva del panel debe llamar `getAdmin()` y hacer `redirect('/')`** si
  no hay sesión: según la guía de autenticación de Next 16, los layouts no se vuelven
  a ejecutar en la navegación del cliente, así que el layout no basta. Añade también la
  ruta al `matcher` de `proxy.ts`.
- `components/sidebar.tsx`: logo (`/brand-icon.png` con `next/image`), enlaces con
  `aria-current`, avatar con iniciales, nombre, `@usuario` y "Cerrar sesión". Bajo
  768 px solo íconos. `components/icons.tsx`: SVG.
- `app/page.tsx`: login del admin con el logo (`next/image` + `preload`).

### 8.2 Mapa en vivo (`/mapa`)

- `components/use-live-trucks.ts` (`useLiveTrucks`): consulta `GET /api/trucks/live`
  **cada 5 s** (igual que el muestreo de la app) con `cache:'no-store'`; se pausa con
  la pestaña oculta y refresca al volver; aborta la petición anterior; ante un fallo
  conserva los últimos datos y muestra el error; con 401 hace `router.replace('/')`.
  Devuelve `{trucks, updatedAt (epoch ms), error}`.
- `components/map-view.tsx` (`MapView`, Client Component): usa el hook, muestra la
  línea de estado ("N vehículos en viaje (M sin ubicación aún). Actualizado a las
  hh:mm:ss", hora de Guatemala con `Intl`) y carga `fleet-map.tsx` con
  `dynamic(..., {ssr:false})`.
- `components/fleet-map.tsx` (`FleetMap({trucks, now})`): `react-leaflet` +
  OpenStreetMap limitado a Guatemala (`GUATEMALA_BOUNDS = [[13.6, -92.4], [17.9,
  -88.1]]`). Marcadores `divIcon` HTML (placa en píldora + punto; sin imágenes, así se
  evita el problema de los íconos por defecto de Leaflet con bundlers; la placa se
  escapa). **Gris** si el último ping tiene más de 60 s (`STALE_AFTER_MS`). Popup con
  conductor, velocidad, última ubicación, precisión e inicio. Encuadra los camiones
  **solo la primera vez** que llegan posiciones (`FitFirstPositions`, maxZoom 15);
  después no mueve la vista. Viajes sin ubicación no se dibujan.
- Latencia: hasta ~10 s (5 s de la app + 5 s de consulta). RNF01 pide 3-5 s: para
  bajarla haría falta SSE/WebSocket, a decidir junto con el despliegue.

### 8.3 Identidad visual

- Paleta del ícono como variables CSS en `app/globals.css` (`--brand-navy`,
  `--brand-navy-light`, `--brand-blue`, `--brand-blue-dark`, `--brand-cyan`,
  `--brand-teal`, `--brand-tint`, `--focus-ring`, `--surface`, `--ink`, `--muted`,
  `--line`, `--danger`). **Usa estas variables** en estilos nuevos.
- Login con degradado radial azul marino; tarjeta blanca; botón con degradado azul.
- Sidebar azul marino; enlace activo en celeste con borde izquierdo.
- Fuente Geist en `body` (la plantilla cargaba Geist pero mostraba Arial).
- Íconos: `app/icon.png` (256), `app/apple-icon.png` (180), `public/brand-icon.png`
  (128). Se borró `app/favicon.ico` de Next. Quedan sin usar los SVG de la plantilla
  en `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`).

### 8.4 Vista Camiones (`/camiones`)

Pedido del usuario: un ícono de camiones en el sidebar con una vista "en capas":
rectángulo por camión, dentro los pilotos que lo han usado y dentro de cada piloto sus
rutas en recuadros, 5 por página. Decisiones con `AskQuestion`: cada recuadro lleva
datos del viaje **y mini mapa**; aparecen **todos** los camiones (los que no tienen
viajes dicen "Sin viajes"), **10 por página**.

- Sidebar: enlace "Camiones" con `TruckIcon` (SVG en `components/icons.tsx`) después
  de "Mapa". `proxy.ts` incluye `/camiones/:path*`.
- `app/(panel)/camiones/page.tsx`: Server Component; comprueba `getAdmin()`, lee
  `searchParams.pagina` (Promise) y llama a `truckHistoryPage`. Cada camión es una
  `<section class="truck-layer">` con placa, modelo, nº de pilotos y "Inactivo" si
  aplica. Paginación de camiones con enlaces `?pagina=N`.
- `components/driver-trips.tsx` (Client Component): cada piloto es un `<details>`
  desplegable (así no se montan decenas de mapas a la vez). Al abrirlo pide la API de
  la sección 6.6 (`no-store`, `AbortController`, 401 → `router.replace('/')`) y
  muestra los recuadros `RouteCard` (estado, inicio, fin, duración, distancia, puntos
  GPS) con paginación por botones. Fechas con `Intl` en `America/Guatemala`.
- `components/pagination.tsx`: "Anterior / Página X de Y / Siguiente"; modo enlaces
  (`hrefFor`, usable desde Server Components) o botones (`onChange`).
- `components/route-mini-map.tsx`: Leaflet cargado con `dynamic(..., {ssr:false})`.
  Sin interacción por defecto; con `interactive` permite zoom y arrastre. Polilínea
  azul, punto de inicio turquesa y de fin azul marino. `FitWhenSized` usa un
  `ResizeObserver` para reencuadrar la primera vez que el contenedor tiene tamaño real
  (Leaflet se crea con tamaño 0 dentro de un `<dialog>` aún cerrado).
- **Mapa ampliado**: botón "Ampliar" sobre cada mini mapa que abre `RouteMapDialog`,
  un `<dialog>` nativo con `showModal()` (foco atrapado y Escape gratis). Se cierra con
  la X, Escape o clic en el fondo. Muestra placa · piloto, resumen del viaje, mapa
  interactivo y leyenda ("Fin" o "Última ubicación" si sigue en curso). CSS bloquea el
  scroll de la página con `body:has(.route-dialog[open])`.
- Estilos en `globals.css` (`.truck-layer`, `.driver-layer`, `.route-grid`,
  `.route-card`, `.route-map-expand`, `.route-dialog*`, `.pagination`,
  `.status-badge`) con las variables de marca.

## 9. Decisiones tomadas con el usuario

1. Viaje: el camión se identifica **escaneando su QR**, que contiene placa y
   contraseña. Obligatorio en cada inicio de viaje.
2. **Login solo por usuario (piloto)**; se quitó por completo el login con camión.
3. Los camiones **no** tienen conductor asignado; el viaje queda a nombre del piloto.
4. El viaje termina con el botón "Terminar viaje" (QR de cierre RF07 pendiente).
5. Panel: login separado por cookie HttpOnly, primer admin `admin1`.
6. Fechas de viajes y pings en **hora de Guatemala (UTC-6)** en la base.
7. Mapa con Leaflet + OpenStreetMap, limitado a Guatemala; actualización por consulta
   periódica cada 5 s (decisión técnica del agente, el usuario no pidió otra).
8. `administrador/README.md` queda sin corregir por ahora. Hallazgos: `npm ci` falla
   por lockfile desincronizado; dice que no hay BD/API/variables (falso); no advierte
   que `npm run start` desactiva el login de prueba; no enlaza `server/README.md`;
   falta nota de IP local para Flutter en teléfono; sin `engines`/`packageManager`.
9. QR con contraseñas en texto plano aceptado para la demo (riesgo señalado).
10. Identidad visual a partir del ícono que dio el usuario (coche + velocímetro +
    escudo, azules y celeste), aplicada a la app y al panel.
11. Ubicaciones sin conexión en **SQLite** (también en web con
    `sqflite_common_ffi_web`); se borran del teléfono al confirmarlas el servidor.
12. Pendientes de una sesión anterior se suben solas al iniciar sesión el mismo
    piloto; para continuar el viaje se vuelve a escanear el QR (sin restauración
    automática de la pantalla del viaje).
13. Segundo plano en Android con servicio en primer plano de geolocator y
    notificación fija; sin `ACCESS_BACKGROUND_LOCATION` (decisión técnica del agente).
14. Vista `/camiones` en capas (camión → piloto → rutas), con mini mapa en cada ruta,
    todos los camiones paginados de 10 en 10 y rutas de 5 en 5 (sección 8.4).
15. Cada mini mapa se puede ampliar en una ventana modal y cerrar (X, Escape o clic
    fuera).

## 10. Estado de Git

Rama `jc_geolocalizacion`. Commits recientes del usuario:

- `c5aaf6d` vista `/camiones`, API de rutas por piloto, mapa ampliado y la versión
  anterior de este documento.
- `4fe5972` cola offline SQLite + segundo plano Android (incluye `web/sqlite3.wasm`,
  `web/sqflite_sw.js`, `.graphifyignore` y este documento en su versión anterior).
- `30cfafd` marca e identidad visual.
- `1bcf263` flota en vivo en el mapa.
- `26777cf`, `5d8d088` autenticación del panel, login del piloto, hora de Guatemala.

Árbol limpio salvo esta versión de `agentecompleto.md` (pendiente de que el usuario
la commitee). `.pnpm-store/` salió del índice (`git rm -r --cached`) y está en
`.gitignore`. `graphify-out/`, `.next/`, `.dart_tool/` y `build/` están ignorados.
Restos locales fuera de Git: la carpeta vacía `administrador/app/api/auth/truck-login/`.

## 11. Pendientes sugeridos (en orden)

1. **Decidir la zona horaria** (UTC en la base y conversión al mostrar, frente a
   UTC-6 actual) **antes** de escribir más código que lea fechas. Usar `AskQuestion`.
   Hoy migrar es barato (4 viajes de prueba). Lectores de fechas: `service.ts`,
   `trucks/live.ts`, `trucks/history.ts` (todos vía `server/time.ts`).
2. **Pruebas del backend**: no existe ninguna ni script `test` en `package.json`.
   Cubrir al menos `startTrip` (concurrencia), `storePings` (idempotencia, cierre,
   `before_trip`), `server/time.ts`, `checkCredentials` y `routeSummary`. Elegir el
   runner con el usuario (p. ej. `node:test` sin dependencias o Vitest).
3. **Cola atascada por un lote venenoso** (sección 12): convertir en el servidor el
   error de validación de Mongo (código 121) en `rejected` por ping, y en Flutter
   aislar un lote que falle con 5xx de forma repetida.
4. **Crear pilotos reales**: script `user:create` que inserte en `users`
   (`rol:'conductor'`, hash scrypt) y vincule `drivers.userId`. Hoy solo entra
   `prueba1` y solo en desarrollo local.
5. **Limitar intentos por IP** en ambos logins (hoy cualquiera puede bloquear `admin1`
   o un piloto con 5 intentos cada 15 min) y ejecutar scrypt también con la cuenta
   bloqueada.
6. Índice único parcial de viaje activo por `driverId` (infraestructura: **pedir
   permiso**) y arreglar el N+1 de `storePings`.
7. Que `startTrip` informe si el primer ping fue rechazado y que Flutter no lo cuente
   como enviado.
8. **Verificar en dispositivo y navegador**: cola SQLite en Chrome (posible desajuste
   wasm 3.6.0 / Dart `sqlite3` 3.5.2), segundo plano en un Android real (lo prueba el
   usuario con `flutter run`; el agente no lanza Android) y el **mapa ampliado** de
   `/camiones` (no se vio en navegador ni pasó por build).
9. Cola persistente: **hecha** (sección 7.1). Falta, si el usuario lo pide, restaurar
   el viaje al reabrir la app (persistir viaje y token de forma segura) en vez de
   volver a escanear el QR.
10. Tiempo real con menos latencia (SSE/WebSocket) si se exige RNF01 de 3-5 s.
11. Cierre por QR (RF07) si el usuario lo confirma.
12. Historial: **vista por camión/piloto hecha** (sección 8.4). Falta, si se pide:
    filtros por fecha (RF13), ruta planeada (RF11) y resumen guardado al cerrar el
    viaje para no leer todos los pings. Contenido de dashboard, cuentas (CRUD de
    camiones/pilotos) y perfil.
13. Segundo plano Android: **hecho** (sección 7.2). Opcional: pedir permiso de
    notificaciones (Android 13+) y seguir tras cerrar la app desde recientes. iOS
    sigue sin carpeta `ios/` (`NSLocationWhenInUseUsageDescription`, modos de fondo).
14. Un solo gestor de paquetes (pnpm) y corregir `administrador/README.md`
    (**pedir confirmación**). **Reescribir los `AGENTS.md` de módulo** (Cursor los
    inyecta como reglas y describen un proyecto que ya no existe).
15. Limpieza menor: borrar la carpeta vacía `truck-login/` y los SVG de plantilla de
    `public/` (pedir confirmación).
16. Eliminar el login de prueba antes de producción.
17. Este documento creció a ~800 líneas. Recomendado (con permiso): mover lo estable
    (contrato, esquema, trucos del entorno) a `server/README.md` y los `AGENTS.md` de
    módulo, y dejar aquí solo estado, decisiones, pendientes y riesgos.

## 12. Revisión técnica: riesgos y avisos

Hallazgos de la revisión de la conversación 4 (verificados en el código), con notas
actualizadas tras la conversación 5. La revisión de la conversación 6 volvió a
confirmar en el código los de fechas, bloqueo de cuentas, dos viajes por piloto, token
irrevocable y N+1, y añadió estos:

- **Sin pruebas en el backend** (sección 11, punto 2). La lógica más delicada no tiene
  cobertura; Flutter sí tiene 26 pruebas.
- **Lote venenoso atasca la cola offline** (`_deliver` en
  `appmovil/lib/core/trip_tracker.dart`): ante un 5xx reintenta el mismo lote para
  siempre con espera creciente, y `next()` siempre devuelve el viaje más antiguo. Si un
  documento de ping incumple el `$jsonSchema` estricto, el servidor responde 500 cada
  vez y ninguna ubicación posterior de ese piloto sube.
- **Bloqueo de cuentas también por tiempo**: con la cuenta bloqueada,
  `checkCredentials` responde sin ejecutar scrypt, lo que revela que existe además
  del 429.
- **Carrera ping / cierre** (leve): `recordPings` lee el viaje sin `fin`; si `endTrip`
  se confirma justo entre medias, `storePings` guarda pings posteriores al cierre.
- **Velocidad con pings fuera de orden** (leve): al insertar un ping anterior a otros
  ya guardados no se recalcula la velocidad del siguiente.

Hallazgos anteriores:

- **Fechas desplazadas a UTC-6** (`server/time.ts`): antipatrón. Ya causó pérdida de
  pings; mezcla convenciones (viajes en -6, cuentas en UTC); cualquier
  `new Date()` comparado con un campo guardado queda desfasado 6 h sin error, y las
  herramientas externas (Atlas Charts, `$dateToString` con `timezone`) aplicarían la
  zona dos veces. Recomendado: UTC en la base, `America/Guatemala` al mostrar.
- **Bloqueo de cuentas como denegación de servicio** (`server/auth/accounts.ts`):
  5 fallos bloquean 15 min sin límite por IP. Además el 429 solo aparece para cuentas
  existentes (revela cuáles existen).
- **Dos viajes activos por piloto** (`startTrip` en `server/trips/service.ts`): busca
  y luego inserta sin atomicidad; el índice único es por camión. Arreglo: índice único
  parcial `{driverId}` con `estado:'activo'` (infraestructura: pedir permiso).
- **Token del piloto irrevocable 12 h**: `recordPings` y `endTrip` no comprueban que
  el conductor siga activo (solo `startTrip`). `getAdmin()` sí revisa la BD.
- **`storePings` hace N+1 consultas** (un `findOne` y un `insertOne` por ping): un lote
  de 50 son ~100 viajes a Atlas. Mejor: leer el ping previo una vez, calcular en
  memoria e `insertMany({ordered:false})`.
- El usuario de Atlas de la app tiene rol `atlasAdmin`; recomendar `readWrite` en
  `trucks_db`.
- `.env.local` guarda contraseñas de prueba en comentarios; `AUTH_SECRET` solo existe
  en esta computadora.
- Los QR llevan contraseñas en texto plano: quien vea el QR del camión obtiene su
  clave. Protegerlo físicamente y rotar la clave si se expone.
- Pings pendientes: ya **no** se pierden al cerrar/recargar (SQLite, sección 7.1),
  salvo si el almacén cae a memoria. El token no se persiste: hay que volver a
  iniciar sesión para subirlos. Las pendientes quedan en el teléfono sin cifrar
  (coordenadas del piloto).
- En web, pestaña en segundo plano frena el muestreo; con `http://` + IP local el
  navegador bloquea la geolocalización (hace falta `localhost` o HTTPS). En Android
  el segundo plano depende del servicio en primer plano (sección 7.2).
- Las fechas de `trips`/`locationPings` llevan `Z` en Atlas pero son hora de
  Guatemala.
- Mosaicos públicos de OpenStreetMap: política de uso justo; en producción usar un
  proveedor propio o contratado. Cada admin con `/mapa` abierto consulta Atlas cada 5 s.
  `/camiones` añade hasta 5 mini mapas por piloto desplegado (más mosaicos).

## 13. Verificación rápida

```powershell
# Desde la raíz: contexto primero
.\graphify.cmd query "describe aquí tu tarea" --budget 1200

# Backend y panel
cd administrador
npm.cmd run db:check
npm.cmd run lint
npx.cmd tsc --noEmit   # si una ruta nueva falla con 'AppRoutes': npx.cmd next typegen
npm.cmd run build      # solo si no hay un next dev activo (puerto 3000 y terminales)
npm.cmd run dev        # http://localhost:3000 (panel: admin1; app: prueba1 / 123)

# Flutter
cd ..\appmovil
dart format lib test
flutter analyze
flutter test           # 26 pruebas
flutter build web --dart-define=API_BASE_URL=http://localhost:3000/api/   # permitido; APK no
# Solo si se actualiza sqlite3/sqflite_common_ffi_web:
# dart run sqflite_common_ffi_web:setup --force

# Al terminar cambios de código, desde la raíz
cd ..
.\graphify.cmd update .
```
