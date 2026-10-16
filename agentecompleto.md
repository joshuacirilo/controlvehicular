# Traspaso para el siguiente agente: Control Vehicular

Actualizado: 16 de octubre de 2026. Rama de trabajo: `jc_geolocalizacion`.
Último commit: `6ad0ac9` (incluye todo lo descrito aquí).

Este documento une **dos conversaciones que trabajaron en paralelo** con el mismo
usuario: una hizo el backend de viajes, el GPS y la app Flutter; la otra analizó
el README del administrador e hizo el panel (sidebar, vistas, mapa Leaflet).
Léelo completo antes de actuar. El código y los requisitos siguen siendo la
fuente de verdad: verifica antes de afirmar.

## 0. Primer paso obligatorio: obtener contexto con Graphify

El usuario exige usar Graphify para ahorrar contexto. **No explores carpetas ni
leas archivos completos antes de consultar el grafo.** Flujo:

1. Desde la raíz `controlvehicular`, comprueba que existe `graphify-out/graph.json`.
   Si no existe, genéralo con `.\graphify.cmd extract . --code-only`.
2. Consulta el grafo sobre la tarea concreta antes de leer código:

   ```powershell
   .\graphify.cmd query "pregunta concreta sobre la tarea" --budget 1200
   .\graphify.cmd explain "NombreRealDelSimbolo"
   .\graphify.cmd path "SimboloOrigen" "SimboloDestino"
   ```

   Ejemplos útiles para este proyecto:
   `query "mapa leaflet panel trucks live" --budget 800`,
   `explain "FleetMap"`, `explain "Sidebar"`, `explain "TripTracker"`,
   `query "startTrip recordPings endTrip" --budget 800`.
3. Lee solo los archivos y fragmentos que el grafo señale. No cargues
   `graph.json` ni todo `GRAPH_REPORT.md`. Si el grafo no muestra algo, haz una
   búsqueda puntual: su ausencia en el grafo no prueba que no exista.
4. Después de cada conjunto de cambios de código ejecuta `.\graphify.cmd update .`
   desde la raíz y confirma que terminó bien.
5. `update .` solo indexa código (AST). Para cambios en documentos hace falta el
   flujo semántico `$graphify --update`, que **nunca se ha ejecutado**: no
   afirmes que la documentación está indexada.
6. En la entrega, indica si consultaste y actualizaste el grafo.

Detalles técnicos de Graphify en la sección 4. Que haya archivos de
`graphify-out/` modificados es normal y no es motivo para saltarse el grafo.

## 1. Qué es el proyecto

Sistema de control de flota: el conductor usa una app **Flutter** (`appmovil/`)
para iniciar y terminar viajes escaneando el QR del camión y enviar su GPS; los
administradores usan un panel **Next.js full-stack** (`administrador/`) que
también expone la API HTTP que consume Flutter. Base de datos: **MongoDB Atlas**.

Documentos de rol que hay que respetar (léelos según la tarea, tras consultar
el grafo):

- `README_AGENTE_FLUTTER.md` y `appmovil/AGENTS.md`: agente Flutter.
- `README_AGENTE_MODULO_ADMIN.md` y `administrador/AGENTS.md`: agente Next.js.
- `AGENTS.md` (raíz): reglas de Graphify.
- `documentacion/Requerimientos.md` (RF01-RF16, RNF01-RNF11) y los roles de
  Joshua (mobile), Luis (backend), Ericka (frontend) y Brandon (DBA).
- `administrador/server/README.md`: **contrato vigente de la API de viajes**,
  usuario de prueba y comprobación de Atlas.

Ojo: varios documentos describen el estado inicial y ya no son ciertos:

- Los dos `AGENTS.md` de módulo dicen "plantilla, sin MongoDB, sin login" y
  proponen Mongoose. Se usa el driver nativo `mongodb` y hay login, viajes y GPS.
- `administrador/README.md` (guía de instalación) está **desactualizado**; ver
  sección 5.5. No lo sigas al pie de la letra.

## 2. Reglas del usuario (obligatorias)

- **Responder siempre en español.** El usuario pidió actuar como senior dev.
- **Usar Graphify antes de explorar** y actualizarlo al terminar (sección 0).
- **No generar APK ni AAB** ni ejecutar builds o lanzamientos Android.
  `flutter build web` sí está permitido para verificar compilación.
- No desplegar ni modificar infraestructura externa (Atlas, Vercel) sin permiso.
- **Nunca imprimir secretos.** `administrador/.env.local` contiene usuario y
  contraseña de Atlas y `AUTH_SECRET`; si necesitas inspeccionarlo, enmascara.
  Está ignorado por Git.
- Antes de escribir código Next.js, leer la guía en
  `administrador/node_modules/next/dist/docs/` (Next 16.3.6 tiene cambios: por
  ejemplo `params` de Route Handlers es una Promise; existe `RouteContext<'/ruta'>`;
  `ssr: false` de `next/dynamic` solo funciona dentro de un Client Component).
- Tras cambios: Flutter `flutter analyze` + `flutter test`; Next.js
  `npm run lint` + `npx tsc --noEmit` + `npm run build`. **No ejecutes
  `npm run build` si hay un `next dev` activo** sobre la misma carpeta: ambos
  escriben en `.next`. En ese caso informa que el build quedó pendiente.
- Commits: **el usuario hace sus propios commits**. No hagas commit ni push
  salvo que lo pida.
- Usar `AskQuestion` cuando haya una decisión de producto real (así se decidió
  el QR del camión y el cierre por botón).
- Implementar solo lo pedido. Cuando el usuario dice "solo crea las vistas",
  no agregues datos ni lógica de negocio.

## 3. Entorno del usuario (particularidades importantes)

- Windows 11, PowerShell 5.1, proyecto dentro de **OneDrive**. Node 24.19,
  pnpm 10.27.0, Flutter 3.47.5 / Dart 3.13.4, Next 16.3.6, React 19.2.8.
- **Smart App Control** bloquea ejecutables sin firma (error `os error 4551`,
  "Una directiva de Control de aplicaciones bloqueó este archivo").
  Afectaba a `.venv-graphify\Scripts\python.exe` y `graphify.exe`; ya se resolvió
  (sección 4). No propongas desactivar Smart App Control: es irreversible.
- `uv` está en `%USERPROFILE%\.local\bin\uv.exe` (no siempre en el PATH del agente).
- **Gestor de paquetes de `administrador/`: pnpm.** `node_modules` usa
  junctions de pnpm y `pnpm-lock.yaml` es el único lockfile sincronizado.
  `package-lock.json` está desactualizado (le faltan `mongodb`, `@next/env`,
  `leaflet`, `react-leaflet`, `@types/leaflet`), así que **`npm ci` falla**.
  Para dependencias nuevas usa `pnpm add` dentro de `administrador/`.
  Los scripts sí se pueden ejecutar con `npm.cmd run <script>`.
- **Detén `next dev` antes de `pnpm add`/`pnpm install`.** En esta sesión, un
  `pnpm add` con el servidor encendido reconstruyó los 367 paquetes (había
  restos instalados con npm), falló con `EPERM` en el binario nativo de
  Tailwind (`@tailwindcss/oxide-win32-x64-msvc`) y tumbó el servidor con
  errores `Can't resolve 'server-only'`. Esa fue la causa de que
  `node_modules\next` "desapareciera" momentáneamente. Tras terminar la
  instalación, los archivos volvieron y bastó con reiniciar `next dev`.
- La raíz del repositorio **no tiene `package.json`**. Si alguien ejecuta
  `npm install` desde la raíz, npm sube hasta `C:\Users\jciri\package.json`, que
  es **otro proyecto del usuario** (Express, pg, TypeORM). Así se instaló Leaflet
  por error ahí; ya se desinstaló (sección 5.4). Instala siempre dentro del módulo.
- `.pnpm-store/v10/projects/<hash>` contiene **junctions** que apuntan a
  `administrador/` y a `.cache/db-lock`. **Nunca** borres `.pnpm-store` con
  `Remove-Item -Recurse` (podría borrar el contenido real de `administrador/`);
  para quitar un enlace usa `cmd /c rmdir "<enlace>"`.
- Next 16 no permite dos `next dev` sobre la misma carpeta: el segundo informa
  "Another next dev server is already running" con el PID. Un proceso huérfano
  de Next puede seguir escuchando aunque su terminal haya terminado; no mates
  procesos que no iniciaste sin avisar al usuario.
- A veces el servidor escucha solo en IPv6 (`::`): `http://localhost:3000` y
  `http://[::1]:3000` responden, pero `http://127.0.0.1:3000` no conecta.
- En PowerShell 5.1, `2>&1` con `$ErrorActionPreference='Stop'` convierte la
  salida informativa de `uv`/`node` por stderr en error; no es un fallo real.
- npm muestra `Unknown env config "devdir"`: aviso inofensivo. pnpm avisa de
  `Ignored build scripts: unrs-resolver`: tampoco bloquea.
- La red del usuario sale por **dos IPs públicas alternas**: `181.174.106.2` y
  `190.104.116.14`. Atlas debe tener ambas en Network Access (ya funciona).
- Leer o modificar archivos fuera del repositorio (por ejemplo
  `C:\Users\jciri`) requiere aprobación explícita del usuario.

## 4. Graphify (ya funciona)

- Usar siempre `.\graphify.cmd <comando>` o `.\graphify.ps1` **desde la raíz**
  (desde `administrador/` el comando no se encuentra).
  No llamar los `.exe` del venv: Smart App Control los bloquea.
- Los lanzadores leen el Python base desde `home` en `.venv-graphify/pyvenv.cfg`
  y ejecutan `python -m graphify` con `PYTHONPATH=.venv-graphify/Lib/site-packages`.
- `scripts/install-graphify.cmd|ps1` instala con
  `uv pip install --python <python base> --target .venv-graphify/Lib/site-packages`.
- `.codex/hooks.json` usa `.\graphify.cmd hook-check`.
- `.graphifyignore` excluye `.pnpm-store/` (evita nodos duplicados).
- `update .` hace copia de seguridad del grafo en `graphify-out/<fecha>/` y
  avisa de que las etiquetas de comunidades cambiaron (`graphify label`); es
  informativo. Último `update .`: tras el límite de Guatemala del mapa
  (583 nodos, 786 aristas).

## 5. Estado actual por módulo

### 5.1 Base de datos Atlas (`trucks_db`)

El DBA ya creó colecciones con **validadores `$jsonSchema` estrictos** e índices.
Respeta sus nombres de campo (en español):

| Colección | Campos requeridos / notas |
| --- | --- |
| `trucks` | `placa` (`^[A-Z0-9-]+$`), `qrCode` único, `modelo`, `activo`, `createdAt`, `updatedAt` |
| `drivers` | `userId` (ObjectId o null), `nombre`, `licencia` única, `telefono`, `activo`, fechas |
| `trips` | `truckId`, `driverId` (ObjectId), `rutaPlaneada` (LineString o null), `estado` (`activo`/`finalizado`), `inicio`, `fin` (null si activo), fechas. Índice **único parcial** `truckId` con `estado:'activo'` |
| `locationPings` | `pingId`, `tripId`, `truckId`, `coords` GeoJSON Point `[lng, lat]`, `velocidad` (≥0 o null), `timestamp`, `receivedAt`. Índice único `{tripId, pingId}`, `2dsphere` en `coords`. Se permiten campos extra (guardamos `driverId` y `precision`) |
| `users` | `email` único, `passwordHash`, `rol` (`administrador`/`conductor`), `activo`, fechas. **Vacía; aún no se usa** |

Datos demo: camiones `aa0000000000000000000001`..`05` (placas `DEMO-001`..`005`,
QR `TRUCK-DEMO-001`..`005`); conductores `bb0000000000000000000001`..`05`
("Conductor Demo Uno".."Cinco", `userId: null`); 2 viajes finalizados y 12 pings
de ejemplo.

Última comprobación (16/10/2026, 12:45): `npm run db:check` en `administrador/`
autenticó y respondió al ping; una consulta de solo lectura confirmó
`trucks` 5, `drivers` 5, `trips` 2, `locationPings` 12, `users` 0 documentos.
La escritura no se probó en esa comprobación.

### 5.2 Backend Next.js (`administrador/`)

Hecho en la conversación de backend/Flutter:

- `server/auth/session.ts`: token HMAC-SHA256 (formato `payload.firma`
  base64url) firmado con `AUTH_SECRET` (≥32 caracteres, en `.env.local`;
  documentado en `.env.example`). Dura 12 h, sin renovación. Payload:
  `{sub, name, role:'conductor', driverId, exp}`. `authenticateDriver(request)`.
- `app/api/auth/login/route.ts`: login **de prueba** (solo `NODE_ENV=development`
  y fuera de Vercel; con `npm run start` responde 403) contra
  `server/auth/test-users.json` (hash scrypt). Usuario `prueba1` / contraseña
  `123`, vinculado a `driverId bb…01`. Devuelve `{mode:'test', user, token, expiresAt}`.
- `server/db/mongo.ts`: `MongoClient` cacheado en `globalThis`.
- `server/env.ts`: `getMongoConfig()` (marcado `server-only`).
- `server/http.ts`: `reply`, `preflight`, `readJsonObject`.
- `server/cors.ts`: lista blanca por `CORS_ALLOWED_ORIGINS` (en desarrollo
  `http://localhost:8080` y `127.0.0.1:8080`); permite `Authorization`.
- `server/trips/pings.ts`: validación de pings y cálculo de velocidad
  (haversine, km/h, 1 decimal; `null` si es el primero o Δt < 1 s; `0` si el
  desplazamiento ≤ precisión GPS).
- `server/trips/service.ts`: `startTrip`, `recordPings`, `endTrip`.
- `server/trips/handler.ts`: autenticación + mapeo de errores (503 si falla la BD,
  logs sin datos sensibles).
- Rutas: `GET /api/health`, `POST /api/auth/login`, `POST /api/trips/start`,
  `POST /api/trips/[id]/ping`, `POST /api/trips/[id]/end`. Contrato completo en
  `server/README.md`.
- `scripts/check-db.mjs` (`npm run db:check`): ping a Atlas sin imprimir
  credenciales; explica el error TLS por IP no autorizada.

Reglas de negocio implementadas: el conductor sale del token (nunca del cuerpo);
un camión solo admite un viaje activo (409); un conductor con viaje activo en
otro camión recibe 409; repetir el inicio con el mismo camión reanuda (200,
`resumed:true`); pings idempotentes por `pingId`; tras el cierre se aceptan pings
con `timestamp <= fin` y los posteriores se rechazan con `trip_closed`; el cierre
es idempotente.

Verificado de extremo a extremo contra Atlas real (los datos de prueba se
borraron): 401 sin token o con token alterado, 404 QR inexistente, 201/200/409 en
inicio, velocidad 48 km/h calculada, duplicados sin duplicar, 400 datos inválidos,
cierre idempotente y pings tardíos. Lint, `tsc` y `npm run build` correctos.

**Aún no existe** `GET /api/trucks/live` ni ningún endpoint de lectura para el panel.

### 5.3 App Flutter (`appmovil/`)

- `lib/core/api_client.dart`: `API_BASE_URL` por `--dart-define` (por defecto
  `http://localhost:3000/api/`; en release exige HTTPS). `login()` devuelve
  `AuthSession(name, token)`. `startTrip`, `sendPings`, `endTrip`; errores como
  `ApiException(message, statusCode)` (statusCode null = sin conexión).
  Modelos: `TripInfo`, `PingSample` (id aleatorio de 32 hex, estable al
  reintentar), `PingResult`.
- `lib/core/qr_credentials.dart`: QR de login en JSON o texto con etiquetas
  (`Usuario: prueba1` / `Contraseña: 123`). El QR de ejemplo del usuario usa
  el formato de etiquetas.
- `lib/core/truck_qr.dart`: valida el QR del camión (`^[A-Za-z0-9_-]{1,200}$`).
- `lib/qr_scan_page.dart`: escáner genérico `QrScanPage<T>(title, instructions,
  parse)` con recuadro guía; en Android limita la lectura al recuadro
  (`scanWindow`); en web solo es guía visual.
- `lib/core/location_service.dart`: `currentLocation()` con `geolocator` 14.1.1.
  En nativo comprueba servicio y permisos; en web pide la posición directamente.
  Límite de 20 s aplicado desde Dart porque `geolocator_web` 4.1.4 pasa
  `timeLimit` en unidad incorrecta y su `requestPermission` no tiene límite.
- `lib/core/trip_tracker.dart` (`ChangeNotifier`): inicio por QR + ping inicial;
  muestreo **cada 5 s**; cola **en memoria** (máx. 2000, cuenta descartes);
  envío por lotes de 50; reintento con espera creciente por ticks
  (5 s → 60 s); 400 descarta y cuenta; 401 detiene y marca sesión vencida;
  404 o `estado != activo` detiene (cerrado remotamente); el cierre solo se
  confirma si no quedan pendientes y el servidor responde `finalizado`.
- `lib/trip_home_page.dart`: UI del viaje (camión, tiempo, velocidad del
  servidor, coordenadas, enviadas/pendientes, conexión, avisos). Cerrar sesión
  bloqueado durante el viaje. Tarjeta de sesión vencida.
- `lib/login_page.dart`: crea y libera el `TripTracker` por sesión.
- `android/app/src/main/AndroidManifest.xml`: `ACCESS_FINE_LOCATION` y
  `ACCESS_COARSE_LOCATION` (solo primer plano).
- Pruebas: `test/qr_login_test.dart`, `test/widget_test.dart`,
  `test/trip_home_test.dart` (15 en total, todas pasan). Las pruebas del tracker
  usan `testWidgets` con tiempo simulado y deben llamar a `_finish` (desmonta y
  libera el tracker) antes de terminar, o fallan por temporizador pendiente.
- `flutter build web` compila. No se validó en dispositivo Android ni en
  navegador con cámara/GPS reales.

Ejecutar: `npm run dev` en `administrador/` y `scripts\run-flutter-web.cmd`
(Chrome en puerto 8080 con `API_BASE_URL=http://localhost:3000/api/`).

### 5.4 Panel administrador (`administrador/`)

Hecho en la conversación del panel, a petición del usuario ("solo crea las
vistas"):

- **Login** (`app/page.tsx`, Client Component): al validar credenciales guarda
  los datos públicos del usuario y redirige a `/dashboard` con
  `router.replace`. Ya no muestra la tarjeta "Hola, …". **Ignora el `token`**
  que ahora devuelve el login.
- `lib/session.ts`: `saveSessionUser`, `clearSessionUser`, `hasSessionUser` y
  el hook `useSessionUser` (`useSyncExternalStore` sobre `sessionStorage`,
  clave `cv-admin-user`, evento propio `cv-admin-session`). Es **estado solo
  visual, no autenticación**: cualquiera puede escribir en `sessionStorage`.
  Debe reemplazarse por una sesión validada en servidor cuando haya login real.
- Grupo de rutas `app/(panel)/` (no aparece en la URL) con `layout.tsx` que
  renderiza `<Sidebar />` y `<main className="panel-main">`.
  Vistas: `/dashboard`, `/mapa`, `/cuentas` (Control de cuentas) y `/perfil`
  (Panel de usuario). Dashboard, cuentas y perfil muestran **solo el título**,
  como pidió el usuario.
- `components/sidebar.tsx` (Client Component): enlaces Dashboard, Mapa y
  Control de cuentas con estado activo (`aria-current`); abajo, avatar con
  iniciales, nombre y `@usuario`, que enlaza a `/perfil`, y botón "Cerrar
  sesión". Si no hay usuario en `sessionStorage`, redirige a `/`. El efecto lee
  `sessionStorage` directamente porque durante la hidratación el hook devuelve
  el snapshot del servidor (`null`). Bajo 768 px el sidebar queda solo con íconos.
- `components/icons.tsx`: íconos SVG propios (no hay librería de íconos).
- **Mapa** (`/mapa`):
  - `components/map-view.tsx` (Client Component) carga `fleet-map` con
    `next/dynamic` y `ssr: false`, porque Leaflet usa `window` al importarse.
    Placeholder "Cargando mapa…".
  - `components/fleet-map.tsx`: `MapContainer` de `react-leaflet` con mosaicos
    de OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, con
    atribución). Importa `leaflet/dist/leaflet.css`.
  - **Limitado a Guatemala**: `GUATEMALA_BOUNDS = [[13.6, -92.4], [17.9, -88.1]]`
    se usa como `bounds` inicial y `maxBounds` con `maxBoundsViscosity={1}`.
    El componente `LockToGuatemala` recalcula el zoom mínimo con
    `map.getBoundsZoom` al montar y en cada `resize`. El límite es rectangular:
    en los bordes se ven partes de México, Belice, Honduras, El Salvador y el
    Pacífico. Para mostrar solo el país haría falta una máscara con el GeoJSON
    de la frontera (no hay archivo en el proyecto).
  - Aún **no dibuja camiones** (falta `GET /api/trucks/live`).
- Estilos en `app/globals.css` con clases propias (`panel-*`, `sidebar-*`,
  `map-*`, `fleet-map`) y la paleta índigo del login (`#4338ca`).
- Dependencias: `leaflet` 1.9.4, `react-leaflet` 5.0.0, `@types/leaflet` 1.9.22,
  instaladas con `pnpm add` en `administrador/`. Se desinstalaron con
  `npm uninstall` de `C:\Users\jciri\package.json` (con aprobación del
  usuario). El `npm install` original había cambiado además otros 10 paquetes
  de ese proyecto, y eso no se revirtió.
- Verificado: lint y `tsc` correctos; `/`, `/dashboard`, `/mapa`, `/cuentas`,
  `/perfil` y `/api/health` responden 200 con el sidebar/marco del mapa.
  **No verificado en navegador**: redirección tras login, nombre en el sidebar,
  cierre de sesión, mosaicos y límites del mapa. `npm run build` no se
  ejecutó en esa conversación porque había un `next dev` activo.

### 5.5 Análisis del `administrador/README.md` (pendiente de corregir)

El usuario pidió un análisis como senior dev y decidió **no corregirlo todavía**.
Hallazgos:

1. **`npm ci` falla**: `package-lock.json` está desincronizado de
   `package.json` (las dependencias se agregaron con pnpm). El README impone
   npm y prohíbe tocar los lockfiles, lo que bloquea la instalación. Mantener
   dos lockfiles provocó la deriva: hay que elegir un solo gestor (de facto, pnpm).
2. **Sección 3 falsa**: dice que no hay variables de entorno, API ni base de
   datos y que la app es la plantilla de Next.js. Hoy hay `.env.example`
   (`MONGODB_URI`, `MONGODB_DB`, `CORS_ALLOWED_ORIGINS`, `AUTH_SECRET`), API,
   Atlas, login y panel.
3. **Modo producción**: con `npm run start`, el login de prueba devuelve 403;
   el README no lo advierte.
4. Información clave (usuario de prueba, `db:check`, errores de Atlas) solo
   está en `server/README.md`, que el README principal no enlaza.
5. Flutter en un teléfono físico no llega a `--hostname 127.0.0.1`; falta una
   nota sobre la IP de la red local y `CORS_ALLOWED_ORIGINS`.
6. Menores: no hay `engines`, `.nvmrc` ni `packageManager` en `package.json`;
   `@types/node` es `^20` con Node 24; el documento está pensado para agentes
   y le falta un inicio rápido para personas.

## 6. Decisiones tomadas con el usuario

1. El camión del viaje se elige **escaneando su QR** (RF03).
2. El viaje se termina con el **botón "Terminar viaje"**; el QR de cierre (RF07)
   queda para después.
3. Token propio HMAC sin dependencias nuevas, solo para el login de prueba.
4. Velocidad en km/h calculada en el servidor.
5. Se acepta temporalmente el QR de login con contraseña en texto plano, solo
   para la demo (riesgo señalado al usuario).
6. Mapa del panel con **Leaflet + OpenStreetMap**, limitado a **Guatemala**.
7. Panel: sidebar a la izquierda con Dashboard, Mapa y Control de cuentas;
   usuario y panel de usuario abajo. Vistas vacías hasta nuevo aviso.
8. El README del administrador queda sin corregir por ahora (decisión del usuario).

## 7. Pendientes sugeridos (en orden aproximado)

1. **Cola persistente** de pings en el dispositivo (RNF10), p. ej.
   `shared_preferences` u otra opción compatible con web y Android, y
   reconciliar el viaje al reabrir la app (el servidor ya permite reanudar
   escaneando el mismo camión).
2. `GET /api/trucks/live` (última posición por camión, viaje activo, conductor)
   y dibujar marcadores en `components/fleet-map.tsx`; luego tiempo real
   (RF09-RF10). Al añadir marcadores, configurar los íconos de Leaflet (con
   bundlers, el ícono por defecto no carga sin ajustar sus URLs).
3. Proteger el panel y sus endpoints de lectura con autorización real en
   servidor (rol administrador); hoy el panel solo tiene el estado visual de
   `lib/session.ts`.
4. Cierre por QR del camión (RF07) si el usuario lo confirma.
5. Autenticación real con la colección `users` (roles administrador/conductor),
   vincular `drivers.userId`, y eliminar el login de prueba antes de producción.
6. Seguimiento en segundo plano en Android (permisos y servicio en primer plano);
   iOS pendiente (`NSLocationWhenInUseUsageDescription`).
7. Historial filtrable (`GET /api/trips?...`) y detalle de viaje.
8. Elegir un solo gestor de paquetes (recomendado pnpm: quitar
   `package-lock.json`, añadir `packageManager`) y corregir
   `administrador/README.md` según la sección 5.5. **Pedir confirmación antes.**
9. Actualizar `appmovil/AGENTS.md` y `administrador/AGENTS.md` al estado real.

## 8. Riesgos y avisos abiertos

- El usuario de Atlas de la app tiene rol **`atlasAdmin`**; recomendar
  `readWrite` limitado a `trucks_db`.
- **`.pnpm-store/` sigue versionado** (25 archivos en el índice) aunque
  `.gitignore` ya lo excluye. Falta `git rm -r --cached .pnpm-store`
  (no borra archivos locales) y que el usuario lo commitee.
- El QR de login lleva la contraseña en texto plano (solo demo).
- `AUTH_SECRET` existe solo en el `.env.local` de esta computadora; en otra hay
  que generarlo.
- Pings pendientes se pierden si se cierra o recarga la app; el token no se
  persiste (recargar obliga a iniciar sesión).
- En web, una pestaña en segundo plano o la pantalla apagada pueden frenar el
  muestreo cada 5 s.
- El panel no tiene autenticación real: la redirección del sidebar es solo
  experiencia de usuario.
- Los mosaicos públicos de OpenStreetMap tienen política de uso justo; para
  producción conviene un proveedor de mosaicos propio o contratado.

## 9. Estado de Git al momento del traspaso

Rama `jc_geolocalizacion`. El usuario commiteó todo el trabajo de ambas
conversaciones en `6ad0ac9` ("feat: enhance authentication and session
management..."), precedido por `c22db1f` y `542a408`. Solo quedan sin
commitear archivos generados (`graphify-out/`, `.dart_tool/`, `build/`) y este
documento. Revisa `git status` antes de empezar.

## 10. Verificación rápida

```powershell
# Desde la raíz: contexto primero
.\graphify.cmd query "describe aquí tu tarea" --budget 1200

# Backend y panel
cd administrador
npm.cmd run db:check
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build      # solo si no hay un next dev activo
npm.cmd run dev        # http://localhost:3000, login prueba1 / 123

# Flutter
cd ..\appmovil
flutter analyze
flutter test

# Al terminar cambios de código, desde la raíz
cd ..
.\graphify.cmd update .
```
