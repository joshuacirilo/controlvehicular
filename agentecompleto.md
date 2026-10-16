# Traspaso para el siguiente agente: Control Vehicular

Actualizado: 16 de octubre de 2026. Rama de trabajo: `jc_geolocalizacion`.

Este documento resume una conversación larga con el usuario para que otro agente
continúe sin perder contexto. Léelo completo antes de actuar. El código y los
requisitos siguen siendo la fuente de verdad: verifica antes de afirmar.

## 1. Qué es el proyecto

Sistema de control de flota: el conductor usa una app **Flutter** (`appmovil/`)
para iniciar y terminar viajes escaneando el QR del camión y enviar su GPS; los
administradores usan un panel **Next.js full-stack** (`administrador/`) que
también expone la API HTTP que consume Flutter. Base de datos: **MongoDB Atlas**.

Documentos de rol que hay que respetar (léelos según la tarea):

- `README_AGENTE_FLUTTER.md` y `appmovil/AGENTS.md`: agente Flutter.
- `README_AGENTE_MODULO_ADMIN.md` y `administrador/AGENTS.md`: agente Next.js.
- `AGENTS.md` (raíz): reglas de Graphify.
- `documentacion/Requerimientos.md` (RF01-RF16, RNF01-RNF11) y los roles de
  Joshua (mobile), Luis (backend), Ericka (frontend) y Brandon (DBA).
- `administrador/server/README.md`: **contrato vigente de la API de viajes**.

Ojo: los dos `AGENTS.md` de módulo describen el estado inicial ("plantilla, sin
MongoDB, sin login") y proponen Mongoose. Eso ya no es cierto: se usa el driver
nativo `mongodb` y hay login, viajes y GPS. No los tomes como inventario actual.

## 2. Reglas del usuario (obligatorias)

- **Responder siempre en español.** El usuario pidió actuar como senior dev.
- **No generar APK ni AAB** ni ejecutar builds o lanzamientos Android.
  `flutter build web` sí está permitido para verificar compilación.
- No desplegar ni modificar infraestructura externa (Atlas, Vercel) sin permiso.
- **Nunca imprimir secretos.** `administrador/.env.local` contiene usuario y
  contraseña de Atlas y `AUTH_SECRET`; si necesitas inspeccionarlo, enmascara.
  Está ignorado por Git.
- Antes de escribir código Next.js, leer la guía en
  `administrador/node_modules/next/dist/docs/` (Next 16.3.6 tiene cambios: por
  ejemplo `params` de Route Handlers es una Promise; existe `RouteContext<'/ruta'>`).
- Graphify: consultar el grafo antes de explorar y ejecutar
  `.\graphify.cmd update .` después de cambiar código (ver sección 4).
- Tras cambios: Flutter `flutter analyze` + `flutter test`; Next.js
  `npm run lint` + `npm run build` (y `npx tsc --noEmit` si hace falta).
- Commits: hasta ahora **el usuario hace sus propios commits**. No hagas commit
  ni push salvo que lo pida.
- Usar `AskQuestion` cuando haya una decisión de producto real (así se decidió
  el QR del camión y el cierre por botón).

## 3. Entorno del usuario (particularidades importantes)

- Windows 11, PowerShell 5.1, proyecto dentro de **OneDrive**. Node 24.19,
  Flutter 3.47.5 / Dart 3.13.4, Next 16.3.6, React 19.2.8.
- **Smart App Control** bloquea ejecutables sin firma (error `os error 4551`,
  "Una directiva de Control de aplicaciones bloqueó este archivo").
  Afectaba a `.venv-graphify\Scripts\python.exe` y `graphify.exe`; ya se resolvió
  (sección 4). No propongas desactivar Smart App Control: es irreversible.
- `uv` está en `%USERPROFILE%\.local\bin\uv.exe` (no siempre en el PATH del agente).
- `administrador/node_modules` lo gestiona **pnpm** con junctions. Además,
  `.pnpm-store/v10/projects/<hash>` contiene **junctions** que apuntan a
  `administrador/` y a `.cache/db-lock`. **Nunca** borres `.pnpm-store` con
  `Remove-Item -Recurse` (podría borrar el contenido real de `administrador/`);
  para quitar un enlace usa `cmd /c rmdir "<enlace>"`.
- En PowerShell 5.1, `2>&1` con `$ErrorActionPreference='Stop'` convierte la
  salida informativa de `uv`/`node` por stderr en error; no es un fallo real.
- npm muestra `Unknown env config "devdir"`: aviso inofensivo.
- La red del usuario sale por **dos IPs públicas alternas**: `181.174.106.2` y
  `190.104.116.14`. Atlas debe tener ambas en Network Access (ya funciona).
- Durante la sesión **otro agente/persona trabajó en paralelo** en el panel
  (ver sección 9) y en un momento se cerraron los servidores `next dev` y
  `node_modules\next` desapareció momentáneamente (probable reinstalación).
  Si algo "desaparece", reintenta antes de diagnosticar.

## 4. Graphify (ya funciona)

- Usar siempre `.\graphify.cmd <comando>` o `.\graphify.ps1` desde la raíz.
  No llamar los `.exe` del venv: Smart App Control los bloquea.
- Los lanzadores leen el Python base desde `home` en `.venv-graphify/pyvenv.cfg`
  y ejecutan `python -m graphify` con `PYTHONPATH=.venv-graphify/Lib/site-packages`.
- `scripts/install-graphify.cmd|ps1` instala con
  `uv pip install --python <python base> --target .venv-graphify/Lib/site-packages`.
- `.codex/hooks.json` usa `.\graphify.cmd hook-check`.
- `.graphifyignore` excluye `.pnpm-store/` (evita nodos duplicados).
- Ejemplos: `.\graphify.cmd query "pregunta" --budget 800`,
  `.\graphify.cmd explain "TripTracker"`, `.\graphify.cmd update .`.
- `update .` solo indexa código (AST). Los cambios en documentos requieren el
  flujo semántico `$graphify --update`, que no se ha ejecutado.

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
de ejemplo. `npm run db:check` (en `administrador/`) verifica la conexión.

### 5.2 Backend Next.js (`administrador/`)

Implementado en esta conversación:

- `server/auth/session.ts`: token HMAC-SHA256 (formato `payload.firma`
  base64url) firmado con `AUTH_SECRET` (≥32 caracteres, en `.env.local`;
  documentado en `.env.example`). Dura 12 h, sin renovación. Payload:
  `{sub, name, role:'conductor', driverId, exp}`. `authenticateDriver(request)`.
- `app/api/auth/login/route.ts`: login **de prueba** (solo `NODE_ENV=development`
  y fuera de Vercel) contra `server/auth/test-users.json` (hash scrypt). Usuario
  `prueba1` / contraseña `123`, vinculado a `driverId bb…01`. Devuelve
  `{mode:'test', user, token, expiresAt}`.
- `server/db/mongo.ts`: `MongoClient` cacheado en `globalThis`.
- `server/http.ts`: `reply`, `preflight`, `readJsonObject`.
- `server/cors.ts`: lista blanca por `CORS_ALLOWED_ORIGINS` (en desarrollo
  `http://localhost:8080` y `127.0.0.1:8080`); permite `Authorization`.
- `server/trips/pings.ts`: validación de pings y cálculo de velocidad
  (haversine, km/h, 1 decimal; `null` si es el primero o Δt < 1 s; `0` si el
  desplazamiento ≤ precisión GPS).
- `server/trips/service.ts`: `startTrip`, `recordPings`, `endTrip`.
- `server/trips/handler.ts`: autenticación + mapeo de errores (503 si falla la BD,
  logs sin datos sensibles).
- Rutas: `POST /api/trips/start`, `POST /api/trips/[id]/ping`,
  `POST /api/trips/[id]/end`. Contrato completo en `server/README.md`.
- `scripts/check-db.mjs`: ahora explica el error TLS de Atlas por IP no autorizada.

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

## 6. Decisiones tomadas con el usuario

1. El camión del viaje se elige **escaneando su QR** (RF03).
2. El viaje se termina con el **botón "Terminar viaje"**; el QR de cierre (RF07)
   queda para después.
3. Token propio HMAC sin dependencias nuevas, solo para el login de prueba.
4. Velocidad en km/h calculada en el servidor.
5. Se acepta temporalmente el QR de login con contraseña en texto plano, solo
   para la demo (riesgo señalado al usuario).

## 7. Pendientes sugeridos (en orden aproximado)

1. **Cola persistente** de pings en el dispositivo (RNF10), p. ej.
   `shared_preferences` u otra opción compatible con web y Android, y
   reconciliar el viaje al reabrir la app (el servidor ya permite reanudar
   escaneando el mismo camión).
2. `GET /api/trucks/live` y conexión del mapa del panel (`/mapa`, ya existe UI con
   Leaflet hecha en paralelo) a los pings reales; luego tiempo real (RF09-RF10).
3. Cierre por QR del camión (RF07) si el usuario lo confirma.
4. Autenticación real con la colección `users` (roles administrador/conductor),
   vincular `drivers.userId`, y eliminar el login de prueba antes de producción.
5. Seguimiento en segundo plano en Android (permisos y servicio en primer plano);
   iOS pendiente (`NSLocationWhenInUseUsageDescription`).
6. Historial filtrable (`GET /api/trips?...`) y detalle de viaje.
7. Actualizar `appmovil/AGENTS.md` y `administrador/AGENTS.md` al estado real.

## 8. Riesgos y avisos abiertos

- El usuario de Atlas de la app tiene rol **`atlasAdmin`**; recomendar
  `readWrite` limitado a `trucks_db`.
- **`.pnpm-store/` vuelve a estar versionado** (25 archivos) tras un merge desde
  `main`, aunque `.gitignore` ya lo excluye. Falta `git rm -r --cached .pnpm-store`
  (no borra archivos locales) y que el usuario lo commitee.
- El QR de login lleva la contraseña en texto plano (solo demo).
- `AUTH_SECRET` existe solo en el `.env.local` de esta computadora; en otra hay
  que generarlo.
- Pings pendientes se pierden si se cierra o recarga la app; el token no se
  persiste (recargar obliga a iniciar sesión).
- En web, una pestaña en segundo plano o la pantalla apagada pueden frenar el
  muestreo cada 5 s.

## 9. Trabajo en paralelo detectado (no hecho en esta conversación)

En `administrador/` aparecieron, hechos por otra persona/agente: `app/(panel)/`
(páginas `/dashboard`, `/mapa`, `/cuentas`, `/perfil` y `layout.tsx`),
`components/` (`fleet-map.tsx`, `map-view.tsx`, `sidebar.tsx`, `icons.tsx`),
`lib/session.ts` (estado de sesión **solo visual** del panel en `sessionStorage`,
no es autenticación), cambios en `app/page.tsx`, `app/globals.css` y
dependencias `leaflet`, `react-leaflet`, `@types/leaflet`. No los modifiques sin
coordinar. El panel aún no usa el token ni la API de viajes.

## 10. Estado de Git al momento del traspaso

Rama `jc_geolocalizacion`. Último commit del usuario: `542a408`. Hay cambios sin
commitear, tanto de esta conversación (sección 5) como del trabajo en paralelo
(sección 9), además del renombre `appmovil/lib/qr_login_page.dart` →
`qr_scan_page.dart`. Revisa `git status` antes de empezar.

## 11. Verificación rápida

```powershell
# Desde la raíz
.\graphify.cmd query "TripTracker sendPings startTrip" --budget 800

# Backend
cd administrador
npm run db:check
npm run lint
npx tsc --noEmit
npm run build

# Flutter
cd ..\appmovil
flutter analyze
flutter test
```
