# Rol: DBA (Database Administrator)

Responsable de: diseño del esquema de MongoDB, índices, rendimiento de queries, datos semilla, integridad de datos.

## Requerimientos que implementa

**Funcionales (soporte transversal)**
- Diseño de las colecciones que sustentan RF01, RF02, RF03–RF08 (trucks, drivers, trips, locationPings).
- Soporte a RF14 — asegurar que las consultas de historial (por camión, conductor, fecha) sean eficientes.

**No funcionales**
- RNF02 — Escalabilidad: índices geoespaciales (`2dsphere`) y compuestos para soportar crecimiento de flota y alto volumen de pings.
- RNF08 — Apoyar la arquitectura MVC asegurando que el modelo de datos sea coherente con los modelos Mongoose del backend.
- RNF10 — Diseñar el esquema de forma que soporte reintentos de pings sin generar duplicados (ej. idempotencia por timestamp/tripId).

## Plan de 5 días

### Día 1 — Diseño del esquema
- Diseñar el esquema definitivo de las 4 colecciones:
  - `trucks`: `_id`, `placa`, `qrCode` (único), `modelo`, `activo`.
  - `drivers`: `_id`, `nombre`, `licencia`, `telefono`.
  - `trips`: `_id`, `truckId`, `driverId`, `rutaPlaneada` (GeoJSON LineString | null), `estado`, `inicio`, `fin`.
  - `locationPings`: `_id`, `tripId`, `truckId`, `coords` (GeoJSON Point), `velocidad`, `timestamp`.
- Definir índices: `2dsphere` en `coords`, compuesto en `{tripId, timestamp}`, único en `qrCode`.
- Levantar la instancia de MongoDB para desarrollo (Atlas o Docker local) y compartir credenciales/conexión con el equipo.
- **Entregable:** diagrama de modelo de datos + instancia de MongoDB lista para conectar.

### Día 2 — Implementación de esquemas y datos semilla
- Trabajar junto al Backend Developer en la implementación de los schemas Mongoose, validando que coincidan con el diseño acordado.
- Crear datos semilla (seed): 5-10 camiones con QR generado, 5 conductores de prueba.
- Documentar las reglas de integridad (ej. cómo se evita que un camión tenga dos trips activos: a nivel de índice, validación en `Trip`, o lógica de aplicación).
- **Entregable:** base de datos poblada con datos de prueba, reglas de integridad documentadas.

### Día 3 — Validación de escritura
- Simular la inserción de pings a alta frecuencia (varios por segundo) para anticipar el volumen real de `locationPings`.
- Revisar que los índices soporten bien tanto las escrituras (pings) como las lecturas (historial, mapa en vivo).
- Ajustar índices si se detectan cuellos de botella.
- **Entregable:** reporte breve de rendimiento con la configuración de índices validada.

### Día 4 — Rendimiento bajo carga en tiempo real
- Monitorear el comportamiento de la base de datos mientras Backend y Frontend prueban el flujo de tiempo real (Socket.IO).
- Evaluar si conviene una estrategia de retención/archivado de `locationPings` a futuro (TTL index) — documentarlo aunque no se implemente en el MVP.
- Apoyar al backend en la optimización de las queries usadas para `GET /trucks/live`.
- **Entregable:** recomendaciones de retención documentadas; queries de `trucks/live` optimizadas.

### Día 5 — Historial, integración y cierre
- Validar con `explain()` que las queries de historial (`GET /trips?truckId=&driverId=&from=&to=`) usan los índices correctamente.
- Participar en las pruebas de integración: verificar consistencia de datos ante casos límite (dos conductores escaneando el mismo camión, reintentos de pings tras pérdida de conexión).
- Preparar un set de datos de demo limpio (camiones con ruta planificada y camiones sin ruta, para mostrar ambos escenarios).
- Documentar cómo restaurar/poblar la base de datos para la demo.
- **Entregable:** base de datos lista y documentada para la demo, con datos de ambos escenarios (con y sin ruta).
