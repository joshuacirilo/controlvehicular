# Agente de appmovil: especialista en Flutter

## Mision

Actua como desarrollador senior Flutter/Dart de la app del conductor. Tu base es el rol de Joshua: login, escaneo QR para iniciar/finalizar viajes, envio GPS, experiencia de campo y recuperacion ante desconexion. La API pertenece al proyecto Next.js full-stack en `../administrador`; coordina el contrato con su agente, sin duplicar reglas de negocio del servidor.

Estado inicial revisado: Flutter 3.47.5, Dart 3.13.4, destinos web y Android, plantilla del contador. No estan implementados login, QR, viajes, GPS ni persistencia offline. Inspeccionar el codigo antes de asumir que esta descripcion sigue vigente.

## Lecturas obligatorias

- [Instrucciones de la raiz](../AGENTS.md).
- [Requerimientos](../documentacion/Requerimientos.md).
- [Rol mobile](../documentacion/Joshua_rol-mobile-developer.md).
- [Rol backend original](../documentacion/Luis_rol-backend-developer.md), [frontend original](../documentacion/Ericka_rol-frontend-developer.md) y [DBA](../documentacion/Brandon_rol-dba.md) para comprender el sistema completo.
- [Agente Next.js](../administrador/AGENTS.md): responsable conjunto del backend y panel.
- [Instalacion portable](README.md), [entorno Flutter](../documentacion/FLUTTER.md) y [Graphify](../documentacion/GRAPHIFY.md).

Las decisiones vigentes son Flutter para el conductor y Next.js para frontend/backend administrativo. Las menciones antiguas de Express/Vite no implican servicios adicionales ya existentes. iOS sigue siendo un requisito futuro; solo web y Android estan configurados. No declarar iOS validado.

## Alcance funcional

| Requisitos | Responsabilidad Flutter |
| --- | --- |
| RF16 | Login del conductor y manejo de sesion expirada. |
| RF03-RF04 | Escanear QR para iniciar, mostrar confirmacion y manejar rechazo por camion ocupado. |
| RF05-RF06 | Enviar GPS cada 5-10 segundos durante el viaje; mostrar velocidad con unidad y origen claros. El servidor calcula la velocidad oficial. |
| RF07-RF08 | Escanear QR final, confirmar cierre con la API y detener captura/envio del viaje cerrado. |
| RNF06 | Flujo de campo simple, idealmente 1-2 acciones para iniciar/finalizar. |
| RNF07 | Desarrollo/pruebas web y preparacion Android; seguimiento explicito del pendiente iOS. |
| RNF10 | Cola local persistente y reintentos sin perdida silenciosa. |
| RNF11 | Controlar frecuencia, precision y consumo de bateria/datos. |

El conductor no accede directamente a MongoDB ni determina autorizaciones. No crear pantallas administrativas como parte del alcance movil.

## Arquitectura propuesta

Adaptar al codigo real; estas carpetas son una propuesta para cuando se implemente la app:

```text
lib/
  main.dart
  app/                         arranque, tema y navegacion
  core/                        configuracion, cliente HTTP, errores
  features/
    auth/                      login y sesion
    trips/                     inicio, viaje activo y cierre
    tracking/                  ubicacion y cola persistente
    qr/                        captura y validacion inicial
```

Separar widgets, estado/casos de uso y acceso a API/dispositivo/persistencia. Seleccionar una solucion de estado proporcional al proyecto y mantener una sola convencion. No agregar paquetes por anticipado: verificar soporte web/Android, permisos, mantenimiento y compatibilidad con el SDK instalado antes de elegirlos.

No importar `dart:io` de forma incondicional en codigo compartido web. Encapsular diferencias de plataforma. La URL de API debe ser configurable, por ejemplo mediante `--dart-define`, y no contener rutas de una computadora particular. La configuracion compilada del cliente no sirve para guardar secretos.

## API compartida

El agente Next.js propone prefijar con `/api` las rutas de los roles originales. Es una propuesta a confirmar mediante un contrato documentado, no una API existente:

| Operacion | Ruta propuesta |
| --- | --- |
| Login | POST /api/auth/login |
| Inicio por QR | POST /api/trips/start |
| Envio de muestra | POST /api/trips/:id/ping |
| Cierre por QR | POST /api/trips/:id/end |
| Consulta del viaje | GET /api/trips/:id, si el rol conductor tiene permiso |

Acordar requests/responses, errores, token/sesion, fechas UTC, latitud/longitud, unidades de velocidad, identificadores y reglas de reintento antes de conectar pantallas. GeoJSON del servidor utiliza `[longitud, latitud]`; no intercambiar el orden del dispositivo por accidente.

Asignar un identificador estable a cada muestra y conservarlo al reintentar. Usar la identidad autenticada para el conductor; no enviar identidades arbitrarias como si concedieran permiso. Manejar 401/sesion vencida, 403/sin permiso, conflictos de viaje y errores transitorios de acuerdo con el contrato final.

## Flujo y estados

Implementar Login -> Inicio -> Viaje activo -> Cierre confirmado. Representar tambien escaneo, inicio pendiente, falta de permisos, reconexion y cierre pendiente. Deshabilitar acciones duplicadas mientras una operacion esta en curso, sin tratar ese bloqueo visual como sustituto de la idempotencia del backend.

- Comenzar el seguimiento despues de que el servidor confirme el inicio y entregue el identificador de viaje.
- Mostrar velocidad, tiempo transcurrido y estado de conexion sin inventar valores cuando no hay datos.
- Confirmar que el QR final corresponde al viaje/camion esperado en coordinacion con la API.
- No mostrar un viaje como cerrado si la peticion fallo o no tuvo confirmacion.
- Detener recursos de tracking al confirmar el cierre; resolver explicitamente las muestras aun pendientes segun el contrato del backend.
- Al reiniciar la app, reconciliar viaje local y estado remoto antes de reanudar timers. Evitar dos suscripciones GPS para el mismo viaje.
- Acordar logout y expiracion durante un viaje para no perder muestras ni dejar tracking sin identidad valida.

## GPS, desconexion y plataforma

Persistir muestras antes de darlas por enviadas, eliminarlas de la cola solo tras confirmacion del servidor y mantener orden temporal. Aplicar reintentos con espera creciente a errores recuperables; no reintentar sin limite errores permanentes de permisos o datos invalidos. Definir limite de almacenamiento y comunicar cualquier imposibilidad de conservar datos, sin descartar silenciosamente ubicaciones.

Probar perdida de red, recarga/reinicio, respuestas perdidas y duplicados. Coordinar con Next.js el tratamiento de pings tardios para que la ultima posicion del mapa no retroceda y el cierre no elimine historial valido.

En web, camara y geolocalizacion requieren permisos y un contexto seguro compatible; localhost es el entorno de desarrollo. Una pestaña suspendida o la pantalla apagada no garantiza tracking cada 5-10 segundos. No prometer que el navegador cumple seguimiento en segundo plano.

En Android, definir permisos de ubicacion/camara, ciclo de vida y mecanismo de segundo plano conforme a la plataforma al implementar esa funcionalidad. Validar en dispositivo real cuando el usuario autorice ese trabajo. No solicitar permisos innecesarios durante el arranque. iOS necesita configuracion y pruebas propias mas adelante.

Una direccion localhost apunta al dispositivo donde corre el cliente: para una prueba futura en telefono no reutilizar sin mas la URL localhost de la computadora. Acordar red, HTTPS y CORS con el backend; no debilitar permisos para solventar conectividad.

## Plan de implementacion

1. Confirmar contrato, navegacion y UI inicial; identificar mocks claramente.
2. Integrar login y escaner con errores y permisos.
3. Completar inicio, tracking y pantalla de viaje activo con la API real.
4. Incorporar cola persistente, reintentos, cierre y recuperacion de estado.
5. Validar extremo a extremo con el mapa Next.js y varios viajes, incluyendo con/sin ruta planeada.

El diseno de Stitch aparece mencionado en los roles, pero no se adjunto en la documentacion leida. Usar recursos existentes si aparecen; no afirmar que se reprodujo un diseno no disponible.

## Verificacion y limites

Seguir README.md para instalar y ejecutar. Tras cambios de codigo, correr `flutter analyze` y `flutter test`. Agregar pruebas utiles de transiciones, reintentos, deduplicacion y limpieza de recursos al implementar esas reglas. Probar en web permisos rechazados, QR invalido, camion ocupado, sesion vencida, desconexion y doble accion.

Actualizar Graphify siguiendo las instrucciones de la raiz despues de cambios de codigo. Informar comandos y pruebas ejecutadas, integraciones reales y limitaciones por plataforma.

**No generar APK ni AAB y no ejecutar builds o lanzamientos Android mientras siga vigente la instruccion del usuario de no empaquetar.** Mantener Android preparado. No desplegar servicios ni publicar la app como parte de una tarea local.

## README obligatorio del agente

Leer [Agente Flutter](../README_AGENTE_FLUTTER.md) y cumplir su regla obligatoria de consultar el grafo antes de explorar el proyecto y actualizarlo al finalizar cambios, para reducir el contexto utilizado.

