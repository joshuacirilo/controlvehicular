# Traspaso para el siguiente agente: Control Vehicular

Actualizado: 16 de octubre de 2026, 17:40 (hora de Guatemala). Rama: `jc_geolocalizacion`.
Último commit: `30cfafd`. **Todo está commiteado**: el árbol de trabajo está limpio
(los archivos generados están ignorados). El usuario hace sus propios commits.

Este documento resume cuatro conversaciones con el mismo usuario:

1. Backend de viajes + GPS + app Flutter.
2. Panel administrador (sidebar, vistas, mapa Leaflet).
3. API del administrador protegida, login del piloto rehecho, fechas a hora de Guatemala.
4. La última: revisión técnica (sección 12), `.pnpm-store` fuera de Git, **mapa con
   los camiones en vivo** (sección 8.2) e **identidad visual con el ícono de la app**
   (sección 8.3 y 7).

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
   `explain "handleAdminRequest"`, `explain "buildBrandTheme"`.
   Si `explain` dice "Ambiguous", repite con `ruta::Simbolo` (p. ej.
   `administrador/components/fleet-map.tsx::FleetMap`).
3. Lee solo lo que el grafo señale. No cargues `graph.json` ni todo `GRAPH_REPORT.md`.
   Si algo no aparece, haz una búsqueda puntual: su ausencia no prueba que no exista.
4. Tras cada conjunto de cambios de código: `.\graphify.cmd update .` desde la raíz
   (~690 nodos tras la última actualización). Puede imprimir un aviso de
   "community set changed": es informativo.
5. `update .` solo indexa código (AST). El flujo semántico para documentos
   (`$graphify --update`) **nunca se ha ejecutado**: los nodos de este `.md` en el grafo
   están desactualizados (citan una numeración de secciones vieja).
6. En la entrega, indica si consultaste y actualizaste el grafo.

## 1. Qué es el proyecto

Control de flota. El **piloto** inicia sesión en la app **Flutter** (`appmovil/`) con
su usuario, escanea el QR del camión para iniciar un viaje y la app envía su GPS cada
5 s. Los administradores usan un panel **Next.js 16 full-stack** (`administrador/`)
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
(sección 9, punto 8).

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
- **No ejecutes `npm run build` si hay un `next dev` activo.** En la última
  conversación `Get-NetTCPConnection -LocalPort 3000` no devolvió nada y aun así había
  un `next dev` del usuario arrancando; el build se ejecutó en paralelo (sin daño,
  Next 16 separa `.next/dev`). Comprueba también los procesos:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Select ProcessId, CommandLine`.
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
  y lo manda como cookie `cv_admin=<token>`. Así se probó `GET /api/trucks/live`.
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
- Reinstalar: `.\scripts\install-graphify.cmd`. `.graphifyignore` excluye `.pnpm-store/`.
- Último `update .`: tras el cambio de marca (~690 nodos).

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

Datos (última comprobación 16/10/2026 ~14:25 Guatemala; pueden haber cambiado):

- `users`: 1, el administrador `admin1` (contraseña en comentarios de `.env.local`).
  **No hay pilotos reales** (`rol:'conductor'`).
- `drivers`: 5 demo (`bb0000000000000000000001`..`05`, "Conductor Demo Uno".."Cinco",
  `userId: null`).
- `trucks`: 1, `PRUEBA123` (modelo "Camion de prueba", `qrCode` `TRUCK-PRUEBA123`,
  con `passwordHash`).
- `trips`: 1 finalizado y 1 **activo** (`PRUEBA123`, "Conductor Demo Uno", inicio
  13:56:33), ambos del usuario probando con `prueba1`. Su último ping era de las
  14:13:34 (la app había dejado de enviar), por eso el mapa lo muestra en gris.
- Entre 14:01:54 y ~14:03:30 se perdieron pings del viaje activo: durante la
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

### 6.6 Verificación hecha (última conversación)

Lint correcto; `tsc` limpio (el error viejo de `.next/types` sobre `truck-login`
desapareció tras el build). `npm run build` correcto (ruta dinámica
`/api/trucks/live`). E2E contra Atlas con el `next dev` del usuario: `/api/trucks/live`
sin cookie 401, con token de conductor 401, con token de admin 200 con `PRUEBA123` y
su última posición. El panel sirve `app/icon.png`/`apple-icon.png` y `/favicon.ico`
da 404 (se borró el de Next). Tras el cambio de marca no se ejecutó `build` porque
el usuario tenía `next dev` activo.

## 7. App Flutter (`appmovil/`)

- `lib/core/api_client.dart`: `API_BASE_URL` por `--dart-define` (por defecto
  `http://localhost:3000/api/`; en release exige HTTPS). `login(username, password)`
  → `AuthSession(name, token)`. `startTrip(token, TruckCredentials, firstPing)` envía
  `{placa, password, ping}`. `sendPings`, `endTrip`, `ApiException(message, statusCode)`.
- `lib/core/qr_credentials.dart`: `QrCredentials` (login: `Usuario:`/`Contraseña:` o
  JSON `{username, password}`) y `TruckCredentials` (camión: `Placa:`/`Contraseña:` o
  JSON `{placa, password}`; placa a mayúsculas, `^[A-Z0-9-]{1,20}$`). Acepta etiquetas
  en líneas separadas o en una sola línea y `:` o `=`. Etiquetas desconocidas se
  rechazan: un QR de usuario no pasa como camión y viceversa.
- `lib/qr_scan_page.dart`: `QrScanPage<T>(title, instructions, parse)`.
- `lib/core/location_service.dart`: `currentLocation()` con `geolocator` (alta
  precisión, límite 20 s).
- `lib/core/trip_tracker.dart`: `start(TruckCredentials)` toma la posición, llama a
  `startTrip` con el primer ping; muestreo cada 5 s; cola en memoria (máx. 2000);
  lotes de 50; reintento con espera creciente; 400 descarta; 401 sesión vencida; 404 o
  `estado != activo` detiene. Fija `sentCount = 1` al iniciar aunque el servidor haya
  rechazado el primer ping (pendiente).
- **`lib/core/brand.dart`** (nuevo): `BrandColors` (`navy #01215A`, `navyLight
  #012D76`, `blue #0349B9`, `cyan #34E1FF`, `teal #0DDDDF`, `surface #F1F5F9`,
  `muted #526078`), `buildBrandTheme()` (AppBar azul marino, primario azul, foco azul)
  y `BrandMark(size)` (el ícono con esquinas redondeadas, asset
  `assets/icon/app_icon.png` declarado en `pubspec.yaml`). **Usa `BrandColors` en vez
  de colores sueltos** en pantallas nuevas.
- `lib/main.dart`: `theme: buildBrandTheme()`.
- `lib/login_page.dart`: fondo con degradado radial azul y `BrandMark` como logo;
  botones "Ingresar" e "Ingresar con QR".
- `lib/trip_home_page.dart`: AppBar con `BrandMark(size: 32)` + título; "Comenzar
  viaje" **siempre** abre el escáner del QR del camión. Cerrar sesión bloqueado durante
  el viaje. Aún quedan colores sueltos de estado (rojo, verde, ámbar) a propósito.
- Íconos: `android/app/src/main/res/mipmap-*/ic_launcher.png` (48-192 px),
  `web/favicon.png` (32), `web/icons/Icon-*.png` y `Icon-maskable-*.png` (192/512),
  generados desde la imagen de 1024 px del usuario. No hay carpeta `ios/`.
- Android: `android:label="Control vehicular"`; pantalla de arranque azul marino con el
  ícono centrado (`res/values/colors.xml` → `brand_navy`, `drawable*/launch_background.xml`).
- Web: `manifest.json` y `index.html` con nombre "Control vehicular", `theme_color` y
  `background_color` `#01215A`, `lang="es"` y fondo azul mientras carga Flutter.
- Pruebas: 17, todas pasan (`qr_login_test.dart`, `trip_home_test.dart`,
  `widget_test.dart`).
- En PC la precisión es ~149 m (WiFi/IP), por eso la velocidad sale 0.

Ejecutar: `npm.cmd run dev` en `administrador/` y `scripts\run-flutter-web.cmd` (Chrome,
puerto 8080, `API_BASE_URL=http://localhost:3000/api/`). Tras cambios en Dart, el
usuario pulsa `R` (hot restart); **si cambian assets o `pubspec.yaml` hay que detener
y relanzar** el script.

## 8. Panel administrador: vistas

### 8.1 Estructura

- Grupo `app/(panel)/`: `/dashboard`, `/mapa`, `/cuentas`, `/perfil`. Dashboard,
  cuentas y perfil muestran **solo el título** (el usuario pidió "solo crea las vistas").
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

## 10. Estado de Git

Rama `jc_geolocalizacion`. Commits recientes del usuario:

- `30cfafd` marca e identidad visual.
- `1bcf263` flota en vivo en el mapa.
- `26777cf`, `5d8d088` autenticación del panel, login del piloto, hora de Guatemala.

Árbol limpio. `.pnpm-store/` salió del índice (`git rm -r --cached`) y está en
`.gitignore`. `graphify-out/`, `.next/`, `.dart_tool/` y `build/` están ignorados.
Restos locales fuera de Git: la carpeta vacía `administrador/app/api/auth/truck-login/`.

## 11. Pendientes sugeridos (en orden)

1. **Decidir la zona horaria** (UTC en la base y conversión al mostrar, frente a
   UTC-6 actual) **antes** de escribir más código que lea fechas. Usar `AskQuestion`.
   Hoy migrar es barato (2 viajes).
2. **Crear pilotos reales**: script `user:create` que inserte en `users`
   (`rol:'conductor'`, hash scrypt) y vincule `drivers.userId`. Hoy solo entra
   `prueba1` y solo en desarrollo local.
3. **Limitar intentos por IP** en ambos logins (hoy cualquiera puede bloquear `admin1`
   o un piloto con 5 intentos cada 15 min).
4. Que `startTrip` informe si el primer ping fue rechazado y que Flutter no lo cuente
   como enviado.
5. Cola persistente de pings (RNF10) y reconciliar el viaje al reabrir la app.
6. Tiempo real con menos latencia (SSE/WebSocket) si se exige RNF01 de 3-5 s.
7. Cierre por QR (RF07) si el usuario lo confirma.
8. Historial filtrable de viajes y detalle con recorrido (RF11-RF14). Contenido de
   dashboard, cuentas (CRUD de camiones/pilotos) y perfil.
9. Seguimiento en segundo plano en Android; iOS (`NSLocationWhenInUseUsageDescription`).
10. Un solo gestor de paquetes (pnpm) y corregir `administrador/README.md`
    (**pedir confirmación**). Actualizar los `AGENTS.md` de módulo.
11. Limpieza menor: borrar la carpeta vacía `truck-login/` y los SVG de plantilla de
    `public/` (pedir confirmación).
12. Eliminar el login de prueba antes de producción.

## 12. Revisión técnica: riesgos y avisos

Hallazgos de la revisión de la última conversación (verificados en el código):

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
- Pings pendientes se pierden al cerrar/recargar la app; el token no se persiste.
- En web, pestaña en segundo plano frena el muestreo; con `http://` + IP local el
  navegador bloquea la geolocalización (hace falta `localhost` o HTTPS).
- Las fechas de `trips`/`locationPings` llevan `Z` en Atlas pero son hora de
  Guatemala.
- Mosaicos públicos de OpenStreetMap: política de uso justo; en producción usar un
  proveedor propio o contratado. Cada admin con `/mapa` abierto consulta Atlas cada 5 s.

## 13. Verificación rápida

```powershell
# Desde la raíz: contexto primero
.\graphify.cmd query "describe aquí tu tarea" --budget 1200

# Backend y panel
cd administrador
npm.cmd run db:check
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build      # solo si no hay un next dev activo (revisa puerto y procesos)
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
