# Traspaso para el siguiente agente: Control Vehicular

Actualizado: 16 de octubre de 2026, 14:10 (hora de Guatemala). Rama: `jc_geolocalizacion`.
Último commit: `1067686`. **Todo lo descrito en las secciones 5 a 7 sobre
autenticación del panel, login del piloto, QR del camión y hora de Guatemala está
SIN COMMITEAR** (ver sección 10). El usuario hace sus propios commits.

Este documento resume tres conversaciones con el mismo usuario: backend de viajes +
GPS + app Flutter; panel administrador (sidebar, vistas, mapa Leaflet); y la última,
que protegió la API del administrador, rehízo el login de la app y cambió las fechas
a hora de Guatemala. Léelo completo antes de actuar. El código es la fuente de verdad:
verifica antes de afirmar.

## 0. Primer paso obligatorio: contexto con Graphify

El usuario exige usar Graphify para ahorrar contexto. **No explores carpetas ni leas
archivos completos antes de consultar el grafo.**

1. Desde la raíz `controlvehicular`, comprueba que existe `graphify-out/graph.json`.
   Si no existe: `.\graphify.cmd extract . --code-only`.
2. Consulta el grafo sobre la tarea concreta:

   ```powershell
   .\graphify.cmd query "pregunta concreta sobre la tarea" --budget 1200
   .\graphify.cmd explain "NombreRealDelSimbolo"
   .\graphify.cmd path "SimboloOrigen" "SimboloDestino"
   ```

   Útiles: `query "startTrip verifyTruck recordPings endTrip" --budget 800`,
   `explain "TripTracker"`, `explain "handleAdminRequest"`, `explain "FleetMap"`.
3. Lee solo lo que el grafo señale. No cargues `graph.json` ni todo `GRAPH_REPORT.md`.
   Si algo no aparece, haz una búsqueda puntual: su ausencia no prueba que no exista.
4. Tras cada conjunto de cambios de código: `.\graphify.cmd update .` desde la raíz.
   Puede imprimir por stderr un aviso de "community set changed... graphify label":
   es informativo, no un fallo.
5. `update .` solo indexa código (AST). El flujo semántico para documentos
   (`$graphify --update`) **nunca se ha ejecutado**.
6. En la entrega, indica si consultaste y actualizaste el grafo.

## 1. Qué es el proyecto

Control de flota. El **piloto** inicia sesión en la app **Flutter** (`appmovil/`) con
su usuario, escanea el QR del camión para iniciar un viaje y la app envía su GPS cada
5 s. Los administradores usan un panel **Next.js 16 full-stack** (`administrador/`)
que también expone la API HTTP que consume Flutter. Base de datos: **MongoDB Atlas**
(`trucks_db`), driver nativo `mongodb` (no Mongoose).

Documentos de rol (léelos según la tarea, tras consultar el grafo):

- `README_AGENTE_FLUTTER.md` y `appmovil/AGENTS.md`: agente Flutter.
- `README_AGENTE_MODULO_ADMIN.md` y `administrador/AGENTS.md`: agente Next.js.
- `AGENTS.md` (raíz): reglas de Graphify.
- `documentacion/Requerimientos.md` (RF01-RF16, RNF01-RNF11) y roles de Joshua
  (mobile), Luis (backend), Ericka (frontend) y Brandon (DBA).
- **`administrador/server/README.md`: contrato vigente** de autenticación (panel y
  app), API de viajes, scripts y manejo de fechas. Está al día.

Desactualizados (no los sigas al pie de la letra): los dos `AGENTS.md` de módulo
("plantilla, sin MongoDB, sin login", proponen Mongoose) y `administrador/README.md`
(sección 9.4).

## 2. Reglas del usuario (obligatorias)

- **Responder siempre en español.** El usuario pide actuar como senior dev.
- **Graphify antes de explorar** y actualizarlo al terminar (sección 0).
- **No generar APK ni AAB** ni builds/lanzamientos Android. `flutter build web` sí.
- No desplegar ni modificar infraestructura externa (Atlas: usuarios, validadores,
  índices, red; Vercel) sin permiso. Cambiar **datos** de prueba en Atlas se ha hecho
  con permiso explícito o como parte directa de lo pedido; limpia siempre lo que crees.
- **Nunca imprimir secretos.** `administrador/.env.local` (ignorado por Git) tiene
  credenciales de Atlas, `AUTH_SECRET` y, en comentarios, contraseñas de prueba.
  Si lo inspeccionas, enmascara valores (`-replace '=.*','=***'`).
- Antes de escribir código Next.js, leer `administrador/node_modules/next/dist/docs/`.
  Next 16.3.6: `middleware` ahora es **`proxy.ts`** (runtime Node, solo comprobaciones
  optimistas); `cookies()` es async; `params` de Route Handlers es una Promise;
  `ssr:false` de `next/dynamic` solo dentro de Client Components.
- Tras cambios: Flutter `dart format lib test` + `flutter analyze` + `flutter test`;
  Next.js `npm.cmd run lint` + `npx.cmd tsc --noEmit` + `npm.cmd run build`.
  **No ejecutes `npm run build` si hay un `next dev` activo** (ambos escriben `.next`).
- **No hagas commit ni push** salvo que el usuario lo pida.
- **No mates procesos que no iniciaste** (el usuario suele tener `next dev` y Flutter
  web corriendo).
- Usar `AskQuestion` para decisiones de producto reales. Si el usuario cancela el
  formulario y responde en texto, sigue su respuesta.
- Implementar solo lo pedido.
- Leer o modificar archivos fuera del repositorio (p. ej. `C:\Users\jciri`) requiere
  aprobación explícita.

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
- **Smart App Control** bloquea ejecutables sin firma (`os error 4551`). No llames los
  `.exe` de `.venv-graphify`; usa `.\graphify.cmd`. No propongas desactivarlo.
- La herramienta de revisión automática puede bloquear `Remove-Item` recursivo; para
  borrar archivos usa la herramienta Delete del agente.
- **Gestor de paquetes de `administrador/`: pnpm** (`pnpm-lock.yaml`).
  `package-lock.json` está desincronizado: `npm ci` falla. Scripts con
  `npm.cmd run <script>`. **Detén `next dev` antes de `pnpm add`/`install`.**
- La raíz no tiene `package.json`: un `npm install` ahí sube a
  `C:\Users\jciri\package.json` (otro proyecto). Instala siempre dentro del módulo.
- `.pnpm-store/` contiene **junctions** a `administrador/`: nunca lo borres con
  `Remove-Item -Recurse`.
- Next 16 no permite dos `next dev` sobre la misma carpeta. El servidor a veces
  escucha solo en IPv6: usa `http://localhost:3000`, no `127.0.0.1`.
- Comprobar quién ocupa el puerto: `Get-NetTCPConnection -LocalPort 3000 -State Listen`.
- La red del usuario sale por dos IPs públicas (`181.174.106.2` y `190.104.116.14`);
  ambas están en Network Access de Atlas.
- No hay decodificador de QR instalado. Para leer una imagen de QR se instaló
  `opencv-python-headless` con `pip --target` en `%TEMP%` usando el Python base de
  `.venv-graphify/pyvenv.cfg` y luego se borró.

## 4. Graphify (funciona)

- Siempre `.\graphify.cmd <comando>` **desde la raíz**.
- Los lanzadores usan el Python base (`home` en `.venv-graphify/pyvenv.cfg`) con
  `PYTHONPATH=.venv-graphify/Lib/site-packages`.
- Reinstalar: `.\scripts\install-graphify.cmd`. `.graphifyignore` excluye `.pnpm-store/`.
- Último `update .`: tras el cambio a hora de Guatemala (~653 nodos).

## 5. Base de datos Atlas (`trucks_db`)

Validadores `$jsonSchema` **estrictos** (`validationLevel: strict`,
`validationAction: error`) creados por el DBA. Permiten campos extra (no usan
`additionalProperties:false` en la raíz).

| Colección | Campos requeridos / notas |
| --- | --- |
| `users` | `email` (índice único con collation `{locale:'en', strength:2}`), `passwordHash`, `rol` (`administrador`/`conductor`), `activo`, fechas. Extras usados: `username`, `nombre`, `failedLogins`, `lockedUntil`, `lastLoginAt`. Sin índice único en `username` (el script comprueba duplicados) |
| `drivers` | `userId` (ObjectId o null), `nombre`, `licencia` única, `telefono`, `activo`, fechas. El piloto se vincula con `drivers.userId = users._id` |
| `trucks` | `placa` (`^[A-Z0-9-]+$`), `qrCode` único, `modelo`, `activo`, fechas. Extras: `passwordHash`, `failedLogins`, `lockedUntil` |
| `trips` | `truckId`, `driverId`, `rutaPlaneada` (null), `estado` (`activo`/`finalizado`), `inicio`, `fin` (null si activo; `$expr` exige `fin >= inicio`), `createdAt`, `updatedAt`. Índice **único parcial** `truckId` con `estado:'activo'` |
| `locationPings` | `pingId`, `tripId`, `truckId`, `coords` GeoJSON `[lng, lat]`, `velocidad` (número o null), `timestamp` (date), `receivedAt` (date). Índice único `{tripId, pingId}`, `2dsphere`. Extras: `driverId`, `precision` |

**Fechas en hora de Guatemala**: `trips` (`inicio`, `fin`, `createdAt`, `updatedAt`) y
`locationPings` (`timestamp`, `receivedAt`) se guardan como **hora local de Guatemala
(UTC-6)**, por decisión explícita del usuario ("no quiero UTC, quiero -6 en la base").
Un BSON date no guarda zona, así que Atlas muestra la hora de Guatemala con sufijo
`Z`. No se usó texto con `-06:00` porque los validadores exigen tipo `date` y
cambiarlos es infraestructura. Ver sección 6.4. **El resto de colecciones** (`users`,
`trucks`, `drivers`: `createdAt`, `lastLoginAt`, `lockedUntil`...) **siguen en UTC**;
se ofreció pasarlas a -6 y el usuario aún no respondió.

Datos actuales (16/10/2026, ~14:05 Guatemala):

- `users`: 1, el administrador `admin1` (contraseña en comentarios de `.env.local`).
  **No hay pilotos reales** (`rol:'conductor'`).
- `drivers`: 5 demo (`bb0000000000000000000001`..`05`, "Conductor Demo Uno".."Cinco",
  `userId: null`).
- `trucks`: 1, `PRUEBA123` (modelo "Camion de prueba", `qrCode` `TRUCK-PRUEBA123`,
  con `passwordHash`). Los 5 camiones demo se borraron en cascada con sus viajes y
  pings. Se le quitó el campo obsoleto `conductorAsignadoId` (con permiso).
- `trips`: 2 del usuario probando desde la app con `prueba1`: `6ad2813e…519`
  (finalizado, 8 pings) y `6ad28171…522` (**activo** en el último momento, ~67+ pings).
  Ambos ya convertidos a hora de Guatemala.
- Entre 14:01:54 y ~14:03:30 (Guatemala) se perdieron pings del viaje activo: durante
  la transición a -6 el servidor los rechazó como `before_trip` y la app los descartó.

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
  `userId` = ese usuario, si no 403 "Tu usuario no está vinculado a un conductor
  activo.") y `verifyTruck(placa, password)` (403 "El QR del camión no es válido o su
  contraseña cambió.", 429 si bloqueado). `normalizePlate` pasa a mayúsculas.
- `test-login.ts` + `test-users.json`: usuario de prueba `prueba1` / `123`, vinculado a
  `bb…01`. Solo con `NODE_ENV=development` y fuera de Vercel.

### 6.2 Panel administrador protegido

- `POST /api/auth/admin/login` `{username, password}` → cookie `cv_admin` (HttpOnly,
  SameSite=Lax, Secure en producción, 8 h). 401 genérico, 429 bloqueo, 503 BD.
- `POST /api/auth/admin/logout` → borra la cookie (204).
- Login/logout y mutaciones por cookie exigen **mismo origen** (`Sec-Fetch-Site` u
  `Origin` vs `Host`), si no 403; sin cabeceras CORS.
- `server/auth/admin.ts`: `getAdmin()` (vuelve a comprobar en Atlas que el admin siga
  activo), `handleAdminRequest(request, handler)` para **todo endpoint de admin
  nuevo**, `adminJson` (no-store), `startAdminSession`, `endAdminSession`.
- `proxy.ts`: redirige a `/` si no hay cookie válida; matcher `/dashboard`, `/mapa`,
  `/cuentas`, `/perfil`. `app/(panel)/layout.tsx` (async) llama `getAdmin()` y pasa
  `user={{username, nombre}}` a `<Sidebar />`.
- `app/page.tsx`: login del admin ("Usuario o correo"). `components/sidebar.tsx`:
  logout con POST y `router.replace('/')`. `lib/session.ts` (sessionStorage) se borró.
- Script: `npm.cmd run admin:create -- --username X --nombre "Nombre" [--email]`
  (contraseña por `ADMIN_PASSWORD` o pedida sin eco, mínimo 12).

### 6.3 Login del piloto y viajes (API que consume Flutter)

Decisión final del usuario: **no existe sesión de camión**. El login es obligatorio y
solo por usuario (el piloto). El QR del camión (placa + contraseña) se exige **solo al
iniciar cada viaje**.

- `POST /api/auth/login` `{username, password}` → `{user:{id, username, name}, token,
  expiresAt}`. Primero prueba `prueba1` (solo dev), luego `loginUser`. 503 si falla BD.
- `POST /api/trips/start` `{placa, password, ping?}` (Bearer). Sin QR → 400 "Escanea el
  QR del camión para iniciar el viaje."; conductor inactivo → 403; QR inválido → 403;
  camión bloqueado → 429; camión ocupado o piloto con viaje activo en otro camión → 409;
  mismo camión con viaje activo → 200 `resumed:true`; nuevo → 201
  `{tripId, inicio, resumed, truck:{placa, modelo}}`.
- `POST /api/trips/:id/ping` `{pings:[...]}` (1-100) y `POST /api/trips/:id/end`:
  filtran por `{_id, driverId}` (cada piloto solo toca sus viajes). Pings idempotentes
  por `pingId`; tras el cierre se aceptan los de `timestamp <= fin`; cierre idempotente.
- `/api/auth/truck-login` **se eliminó** (responde 404). Queda la carpeta vacía
  `app/api/auth/truck-login/` (Git la ignora; se puede borrar a mano).
- Script: `npm.cmd run truck:create -- --placa PRUEBA123 [--modelo "Modelo"]`
  (contraseña por `TRUCK_PASSWORD` o sin eco, mínimo 8; placa en mayúsculas, `qrCode`
  `TRUCK-<placa>`). Ya no acepta `--driver-id`.
- `server/trips/pings.ts`: validación (timestamp ISO, desfase máx. 2 min al futuro,
  7 días al pasado) y velocidad haversine en km/h (null si primero o Δt<1 s; 0 si el
  desplazamiento ≤ precisión GPS).
- Otros: `server/db/mongo.ts` (cliente cacheado), `server/env.ts`, `server/http.ts`,
  `server/cors.ts` (`CORS_ALLOWED_ORIGINS`; dev `localhost:8080`),
  `server/trips/handler.ts` (`handleDriverRequest`), `scripts/check-db.mjs`.

### 6.4 Hora de Guatemala (`server/time.ts`)

- `toGuatemala(instant)` resta 6 h; `guatemalaNow()`; `formatGuatemala(stored)`
  devuelve ISO con `-06:00` (p. ej. `"2026-10-16T13:56:33.603-06:00"`).
- `service.ts` guarda con `guatemalaNow()` y convierte los `timestamp` de los pings
  (que llegan como instantes reales) con `toGuatemala` **antes** de comparar, así las
  comparaciones (`before_trip` con tolerancia de 5 min, `trip_closed`, velocidad y el
  `$expr fin >= inicio`) se hacen entre fechas guardadas.
- Las respuestas de la API usan `formatGuatemala`. Cualquier lector directo de la BD
  (panel, reportes, `GET /api/trucks/live` futuro) debe tratar esas fechas como hora
  de Guatemala, **no** como UTC. Nunca compares un campo guardado con `new Date()`:
  usa `guatemalaNow()`.
- Si alguna vez se vuelve a UTC, hay que migrar los datos (sumar 6 h) en el mismo
  momento del despliegue: mezclar formatos hace que el servidor rechace pings.

### 6.5 Verificación hecha

Lint correcto. `npx tsc --noEmit` solo reporta
`.next/types/validator.ts: Cannot find module '../../app/api/auth/truck-login/route.js'`,
tipos generados por el `next dev` del usuario que apuntan a la ruta borrada; se va al
reiniciar `next dev` (o borrando `.next/types`). `npm run build` **no se ejecutó** en
esta conversación porque el usuario tenía `next dev` activo.

E2E contra el servidor del usuario y Atlas (datos de prueba borrados después): login
prueba1 200; inicio sin QR 400; clave de camión errónea 403; inicio correcto 201;
pings aceptados con velocidad calculada; cierre 200; `/api/auth/truck-login` 404;
admin: login, cookie, lockout (dejó a `admin1` bloqueado y se reinició), token de
admin rechazado en la API de viajes (401).

## 7. App Flutter (`appmovil/`)

- `lib/core/api_client.dart`: `API_BASE_URL` por `--dart-define` (por defecto
  `http://localhost:3000/api/`; en release exige HTTPS). `login(username, password)`
  → `AuthSession(name, token)` (401 → "Usuario o contraseña incorrectos."; otros
  códigos muestran el mensaje del servidor). `startTrip(token, TruckCredentials,
  firstPing)` envía `{placa, password, ping}`. `sendPings`, `endTrip`,
  `ApiException(message, statusCode)`.
- `lib/core/qr_credentials.dart`: `QrCredentials` (login: `Usuario:`/`Contraseña:` o
  JSON `{username, password}`) y `TruckCredentials` (camión: `Placa:`/`Contraseña:` o
  JSON `{placa, password}`; placa a mayúsculas, `^[A-Z0-9-]{1,20}$`). Acepta etiquetas
  **en líneas separadas o en una sola línea** (`placa:prueba123 contraseña: <clave>`,
  formato del QR impreso del usuario) y `:` o `=`. Etiquetas desconocidas se rechazan:
  un QR de usuario no pasa como camión y viceversa. En una sola línea, la contraseña no
  puede contener " placa:"/" contraseña:".
- `lib/qr_scan_page.dart`: `QrScanPage<T>(title, instructions, parse)`.
- `lib/core/location_service.dart`: `currentLocation()` con `geolocator` (alta
  precisión, límite 20 s aplicado desde Dart; en web no pide permisos por separado).
- `lib/core/trip_tracker.dart`: `start(TruckCredentials)` toma la posición, llama a
  `startTrip` con el primer ping; muestreo cada 5 s; cola en memoria (máx. 2000);
  lotes de 50; reintento con espera creciente; 400 descarta; 401 sesión vencida; 404 o
  `estado != activo` detiene.
- `lib/login_page.dart`: botones "Ingresar" y "Ingresar con QR" (QR del usuario).
  Subtítulo "Ingresa con tu usuario de piloto." No hay login con camión.
- `lib/trip_home_page.dart`: "Comenzar viaje" **siempre** abre el escáner "QR del
  camión" y luego `tracker.start(truck)`. Cerrar sesión bloqueado durante el viaje.
- `lib/core/truck_qr.dart` se borró.
- Pruebas: 17, todas pasan (`qr_login_test.dart`, `trip_home_test.dart`,
  `widget_test.dart`), incluida "No trip starts without scanning the truck QR".
- Verificado en vivo: el usuario inició un viaje desde Chrome y llegaron pings cada
  ~5 s a Atlas. En PC la precisión es ~149 m (WiFi/IP), por eso la velocidad sale 0.

Ejecutar: `npm.cmd run dev` en `administrador/` y `scripts\run-flutter-web.cmd` (Chrome,
puerto 8080, `API_BASE_URL=http://localhost:3000/api/`). Tras cambios en Dart, el
usuario pulsa `R` (hot restart) en esa terminal.

## 8. Panel administrador: vistas

- Grupo `app/(panel)/`: `/dashboard`, `/mapa`, `/cuentas`, `/perfil`. Dashboard,
  cuentas y perfil muestran **solo el título** (el usuario pidió "solo crea las vistas").
- `components/sidebar.tsx`: enlaces con `aria-current`, avatar con iniciales, nombre,
  `@usuario` y "Cerrar sesión". Bajo 768 px solo íconos. `components/icons.tsx`: SVG.
- Mapa: `components/map-view.tsx` (dynamic, `ssr:false`) y `components/fleet-map.tsx`
  (`react-leaflet` + OpenStreetMap), limitado a Guatemala
  (`GUATEMALA_BOUNDS = [[13.6, -92.4], [17.9, -88.1]]`, `maxBounds`, zoom mínimo
  recalculado). **Aún no dibuja camiones** (no existe `GET /api/trucks/live`).
- Estilos en `app/globals.css` (paleta índigo `#4338ca`).

## 9. Decisiones tomadas con el usuario

1. Viaje: el camión se identifica **escaneando su QR**, que contiene placa y
   contraseña. Obligatorio en cada inicio de viaje.
2. **Login solo por usuario (piloto)**; se quitó por completo el login con camión
   (se había implementado y luego el usuario lo revirtió).
3. Los camiones **no** tienen conductor asignado; el viaje queda a nombre del piloto
   con sesión.
4. El viaje termina con el botón "Terminar viaje" (QR de cierre RF07 pendiente).
5. Panel: login separado por cookie HttpOnly, primer admin `admin1`.
6. Fechas de viajes y pings en **hora de Guatemala (UTC-6)** en la base.
7. Mapa con Leaflet + OpenStreetMap, limitado a Guatemala.
8. `administrador/README.md` queda sin corregir por ahora. Hallazgos: `npm ci` falla
   por lockfile desincronizado; dice que no hay BD/API/variables (falso); no advierte
   que `npm run start` desactiva el login de prueba; no enlaza `server/README.md`;
   falta nota de IP local para Flutter en teléfono; sin `engines`/`packageManager`.
9. QR con contraseñas en texto plano aceptado para la demo (riesgo señalado).

## 10. Estado de Git

Rama `jc_geolocalizacion`, último commit `1067686`. **Sin commitear** (trabajo de la
última conversación):

- Modificados: `administrador/app/(panel)/layout.tsx`, `app/api/auth/login/route.ts`,
  `app/api/trips/start/route.ts`, `app/page.tsx`, `components/sidebar.tsx`,
  `package.json`, `server/README.md`, `server/auth/session.ts`,
  `server/trips/service.ts`; `appmovil/lib/core/api_client.dart`,
  `qr_credentials.dart`, `trip_tracker.dart`, `lib/login_page.dart`,
  `lib/trip_home_page.dart` y los tres tests.
- Borrados: `administrador/lib/session.ts`, `appmovil/lib/core/truck_qr.dart`.
- Nuevos: `administrador/proxy.ts`, `app/api/auth/admin/` (login, logout),
  `scripts/create-admin.mjs`, `scripts/create-truck.mjs`, `scripts/password.mjs`,
  `server/auth/{accounts,admin,driver-login,password,token}.ts`, `server/time.ts`.
- `.pnpm-store/` sigue versionado (25 archivos): ejecutar
  `git rm -r --cached .pnpm-store` antes del commit (no borra archivos locales).
- Archivos generados sin commitear: `graphify-out/`, `.next/`, `.dart_tool/`, `build/`.

## 11. Pendientes sugeridos

1. **Crear pilotos reales**: script tipo `user:create` que inserte en `users`
   (`rol:'conductor'`, hash scrypt) y vincule `drivers.userId`. Hoy solo entra
   `prueba1` y solo en desarrollo local.
2. `GET /api/trucks/live` (con `handleAdminRequest`) y marcadores en `fleet-map.tsx`;
   luego tiempo real (RF09-RF10). Recordar que las fechas están en hora de Guatemala.
   Configurar íconos de Leaflet con el bundler.
3. Decidir si `users`/`trucks`/`drivers` también pasan a hora de Guatemala.
4. Que `startTrip` informe si el primer ping fue rechazado (hoy se ignora y la app lo
   cuenta como enviado).
5. Cola persistente de pings (RNF10) y reconciliar el viaje al reabrir la app.
6. Cierre por QR (RF07) si el usuario lo confirma.
7. Seguimiento en segundo plano en Android; iOS (`NSLocationWhenInUseUsageDescription`).
8. Historial filtrable de viajes y detalle.
9. Un solo gestor de paquetes (pnpm) y corregir `administrador/README.md`
   (**pedir confirmación**). Actualizar los `AGENTS.md` de módulo.
10. Eliminar el login de prueba antes de producción.

## 12. Riesgos y avisos

- El usuario de Atlas de la app tiene rol `atlasAdmin`; recomendar `readWrite` en
  `trucks_db`.
- `.env.local` guarda contraseñas de prueba en comentarios; está ignorado por Git,
  pero conviene moverlas a un gestor de contraseñas.
- Los QR llevan contraseñas en texto plano: quien vea el QR del camión obtiene su
  clave. Protegerlo físicamente y rotar la clave si se expone.
- `AUTH_SECRET` solo existe en el `.env.local` de esta computadora.
- Pings pendientes se pierden al cerrar/recargar la app; el token no se persiste.
- En web, pestaña en segundo plano frena el muestreo; con `http://` + IP local el
  navegador bloquea la geolocalización (hace falta `localhost` o HTTPS).
- Las fechas de `trips`/`locationPings` llevan `Z` en Atlas pero son hora de
  Guatemala: riesgo de malinterpretarlas en herramientas externas.
- Mosaicos públicos de OpenStreetMap: política de uso justo; en producción usar un
  proveedor propio o contratado.

## 13. Verificación rápida

```powershell
# Desde la raíz: contexto primero
.\graphify.cmd query "describe aquí tu tarea" --budget 1200

# Backend y panel
cd administrador
npm.cmd run db:check
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build      # solo si no hay un next dev activo
npm.cmd run dev        # http://localhost:3000 (panel: admin1; app: prueba1 / 123)

# Flutter
cd ..\appmovil
dart format lib test
flutter analyze
flutter test

# Al terminar cambios de código, desde la raíz
cd ..
.\graphify.cmd update .
```
