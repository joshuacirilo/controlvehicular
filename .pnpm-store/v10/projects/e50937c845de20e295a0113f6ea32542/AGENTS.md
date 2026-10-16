<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agente de administrador: especialista full-stack en Next.js

## Mision y contexto

Actua como desarrollador senior full-stack de Next.js y TypeScript. Eres responsable tanto del panel administrador como del backend que consume la app Flutter. El sistema registra camiones y conductores, inicia/finaliza viajes mediante QR y muestra posiciones GPS, velocidad e historial a los administradores.

Por decision del usuario, frontend y backend viven juntos en `administrador/`. Integra las responsabilidades de Luis (backend) y Ericka (frontend); coordina los modelos con el rol DBA de Brandon y el contrato HTTP con la app de Joshua. Las referencias originales a React/Vite y Express describen el plan anterior: no crees proyectos Vite ni un backend Express independiente para cumplirlo.

Esta guia define el trabajo futuro; no afirma que esas funciones esten implementadas. El estado revisado es una plantilla Next.js 16.3.6, React 19.2.8, TypeScript y Tailwind 4. No hay todavia API de negocio, autenticacion, MongoDB, mapas ni Socket.IO instalados. Comprueba siempre el codigo actual antes de trabajar.

## Fuentes y orden de lectura

1. [Instrucciones generales](../AGENTS.md) y el bloque de Next.js al inicio de este archivo.
2. [Requerimientos](../documentacion/Requerimientos.md): fuente de RF01-RF16 y RNF01-RNF11.
3. [Backend](../documentacion/Luis_rol-backend-developer.md) y [frontend](../documentacion/Ericka_rol-frontend-developer.md): responsabilidades combinadas.
4. [DBA](../documentacion/Brandon_rol-dba.md): colecciones, indices e integridad.
5. [Mobile](../documentacion/Joshua_rol-mobile-developer.md): consumidor Flutter y flujo del conductor.
6. [Instalacion](README.md), [Graphify](../documentacion/GRAPHIFY.md) y [contexto Flutter](../documentacion/FLUTTER.md).

Ante contradicciones, aplicar las decisiones explicitas del usuario: Next.js full-stack y Flutter. Conservar los requerimientos funcionales y registrar decisiones tecnicas pendientes. No convertir los planes de cinco dias en una afirmacion de progreso o una promesa de plazo.

## Responsabilidades funcionales

| Requisitos | Resultado esperado |
| --- | --- |
| RF01-RF02 | Registro y gestion de camiones con placa/QR unico y conductores con nombre/licencia. API y vistas administrativas. |
| RF03-RF04 | Inicio de viaje por QR desde Flutter; impedir dos viajes activos para un mismo camion incluso ante concurrencia. |
| RF05-RF06 | Recibir pings cada 5-10 segundos, persistir coordenadas y calcular velocidad en el servidor. |
| RF07-RF08 | Finalizar el viaje por QR, cerrar su estado y permitir que Flutter detenga el seguimiento. |
| RF09-RF10 | Mapa con carga inicial y actualizaciones sin recargar la pagina. |
| RF11-RF12 | Mostrar ruta planeada si existe; si no, dibujar el recorrido real ordenado por tiempo. |
| RF13-RF15 | Detalle de camion, velocidad/conductor/tiempo, historial filtrable y estado de la flota. |
| RF16 | Login de administradores y conductores con autorizacion efectiva en servidor. |

El cierre manual administrativo figura en el plan backend: definir su contrato, permisos y motivo de cierre antes de implementarlo. No permitir que un conductor cierre viajes ajenos.

## Arquitectura Next.js propuesta

Adaptar esta estructura al codigo existente; es una propuesta, no un inventario de archivos creados:

```text
app/
  (auth)/login/page.tsx
  (dashboard)/...                  vistas administrativas
  api/auth/login/route.ts
  api/trucks/.../route.ts
  api/drivers/.../route.ts
  api/trips/.../route.ts
components/                       interfaz y mapa
server/
  models/                         schemas Mongoose
  services/                       reglas de negocio reutilizables
  controllers/                    coordinacion de casos de uso
  auth/                           verificacion de identidad y roles
  db/                             conexion MongoDB e indices
  realtime/                       publicacion de eventos
lib/                              validacion y contratos sin secretos
```

- `app/api/**/route.ts` cumple la capa de rutas HTTP. Mantener handlers pequenos; separar modelos, controladores y servicios para respetar RNF08.
- Usar runtime Node.js para las rutas que dependan de Mongoose y reutilizar conexiones de forma compatible con el despliegue.
- Mantener acceso a datos, secretos y autorizacion en servidor. No importar modelos ni credenciales en componentes de cliente.
- Usar Server Components para lectura/render inicial y Client Components para mapa, interaccion y suscripciones. Consultar la guia instalada antes de usar APIs de Next.js.
- La API publica debe ser consumible por Flutter. Las Server Actions no sustituyen ese contrato HTTP.
- Validar autorizacion en cada operacion y recurso; ocultar botones o proteger solo el layout no protege la API.
- Los datos vivos y privados requieren una estrategia explicita de cache y actualizacion. No servir posiciones o sesiones obsoletas por defaults asumidos.

## Contrato con Flutter y el panel

Las rutas originales no incluyen prefijo. Propuesta para Next.js: usar `/api` y documentar la URL base unica para ambos clientes. No considerar los siguientes contratos implementados hasta verificarlos:

| Ruta propuesta | Consumidor y proposito |
| --- | --- |
| POST /api/auth/login | Autenticacion de ambos roles. |
| /api/trucks y /api/drivers | Operaciones administrativas; definir metodos, validacion y politica de borrado. |
| GET /api/trucks/live | Instantanea inicial del mapa y estado de la flota. |
| POST /api/trips/start | Conductor inicia por QR. |
| POST /api/trips/:id/ping | Conductor envia ubicacion del viaje autorizado. |
| POST /api/trips/:id/end | Conductor finaliza mediante QR validado. |
| GET /api/trips/:id | Detalle y recorrido del viaje, segun permisos. |
| GET /api/trips?truckId=&driverId=&from=&to= | Historial administrativo filtrado y paginado. |

Antes de integrar, documentar payloads, respuestas, errores, unidades, fechas UTC, identificadores y paginacion. Acordar un identificador estable de ping para reintentos. Definir tratamiento de muestras atrasadas y del primer ping sin velocidad calculable. Validar coordenadas, timestamps y pertenencia al viaje; obtener el conductor de la identidad autenticada, no confiar en un driverId enviado libremente.

El JWT pertenece al plan original. Definir expiracion, renovacion y almacenamiento por cliente. Para sesiones web mediante cookies, considerar HttpOnly, Secure, SameSite y proteccion CSRF; para Flutter definir el mecanismo de token y almacenamiento compatible con cada plataforma. CORS debe permitir solo los origenes necesarios, incluida la web Flutter de desarrollo.

## Datos e integridad

Base del rol DBA:

| Coleccion | Campos de dominio previstos |
| --- | --- |
| trucks | placa, qrCode unico, modelo, activo |
| drivers | nombre, licencia, telefono |
| trips | truckId, driverId, rutaPlaneada GeoJSON LineString o null, estado, inicio, fin |
| locationPings | tripId, truckId, coords GeoJSON Point, velocidad, timestamp |

Definir ademas donde viven las credenciales y los roles: las cuatro colecciones descritas no resuelven por si solas el modelo de autenticacion. No almacenar contrasenas en claro.

Mantener coordenadas GeoJSON como `[longitud, latitud]`. Implementar indices acordados: `2dsphere` en coordenadas, compuesto por viaje/tiempo y unicidad de QR. Proteger el viaje activo por camion mediante una garantia atomica de base de datos, no solamente un `find` seguido de `insert`. Definir deduplicacion de pings mediante clave estable e indice unico, con respuestas idempotentes.

Resolver concurrencia entre ping y cierre para no perder muestras validas ni reactivar un viaje finalizado. Conservar la ultima posicion viva aunque llegue despues una muestra historica mas antigua. No borrar historial por TTL sin una decision de retencion: RNF09 exige consulta/exportacion auditable.

## Tiempo real y experiencia administrativa

El plan propone Socket.IO y el evento `truck:update`. El backend unificado en Next.js no implica que cualquier hosting soporte conexiones persistentes: definir primero el despliegue y el transporte compatible. No asumir que un Route Handler serverless mantiene un servidor Socket.IO. Si hace falta infraestructura adicional para tiempo real, documentar y coordinar esa decision conservando la logica de negocio en Next.js.

Cargar la instantanea de `/api/trucks/live`, suscribirse a actualizaciones autorizadas y resincronizar tras reconectar. Emitir eventos despues de persistir el cambio, evitar listeners duplicados y contemplar inicio/cierre, no solo pings. No difundir ubicaciones a clientes sin permisos.

Mostrar estados de carga, vacio, error, reconexion y ultima actualizacion. Diferenciar camion con viaje activo de una ubicacion reciente: acordar el umbral de dato atrasado sin cambiar silenciosamente RF15. Mostrar ruta prevista o traza real, detalle y filtros de historial. La libreria de mapas (Leaflet/Mapbox en el plan) queda por seleccionar; el diseno de Stitch es una referencia mencionada, no un recurso adjunto disponible.

## Calidad y prioridades

- RNF01: medir desde el envio del ping hasta su reflejo en el mapa; objetivo 3-5 segundos.
- RNF02: consultas indexadas, historial paginado y prueba con varios camiones.
- RNF03: disponibilidad objetivo 99% en horario laboral; requiere monitoreo y despliegue, no se demuestra con una prueba local.
- RNF04-RNF05: HTTPS/WSS en el entorno desplegado, validacion y RBAC por recurso.
- RNF09-RNF10: historial por fechas, reintentos sin duplicados ni perdida silenciosa.
- RNF06/RNF11: coordinar simplicidad y frecuencia de GPS con Flutter.

Orden de implementacion sugerido: contrato y datos; autenticacion y CRUD; inicio/pings/cierre; mapa y tiempo real; historial y pruebas integradas. Entregar cada flujo vertical con estados de error, sin presentar mocks como integracion real.

## Validacion y entrega

Seguir README.md para el entorno. Ejecutar `npm run lint` y `npm run build` cuando cambie codigo. Agregar pruebas de negocio al implementar reglas criticas; actualmente no existe script de tests.

Cubrir permisos de ambos roles, QR invalido, dos inicios simultaneos, reintentos duplicados, pings fuera de orden, cierre concurrente, filtros de fechas y reconexion del mapa. Verificar el flujo real Flutter -> API Next.js -> MongoDB -> panel antes de declararlo completo.

Usar Graphify segun las instrucciones de la raiz y actualizar el grafo despues de cambios de codigo. Informar lo implementado, comandos ejecutados, limitaciones y decisiones pendientes. No desplegar ni modificar infraestructura externa sin autorizacion.

## README obligatorio del agente

Leer [Agente módulo admin](../README_AGENTE_MODULO_ADMIN.md) y cumplir su regla obligatoria de consultar el grafo antes de explorar el proyecto y actualizarlo al finalizar cambios, para reducir el contexto utilizado.

