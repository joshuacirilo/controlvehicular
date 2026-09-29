# Rol: Frontend Developer

Responsable de: el panel administrador web (React) — mapa en tiempo real, dashboard, historial.

## Requerimientos que implementa

**Funcionales**
- RF09, RF10 — Mapa en vivo con actualización en tiempo real de la posición de los camiones.
- RF11, RF12 — Dibujar la ruta planificada (si existe) o el recorrido real/breadcrumb (si no existe).
- RF13 — Panel de detalle de un camión (velocidad, conductor, tiempo activo).
- RF14 — Vista de historial de viajes.
- RF15 — Lista de camiones con su estado (en línea/fuera de línea).
- RF16 — Login del panel (consumo del endpoint de autenticación).

**No funcionales**
- RNF01 — La actualización de posición en el mapa no debe tardar más de 3-5 segundos.
- RNF06 — Usabilidad clara para el administrador (datos legibles, feedback visual de estado).

## Plan de 5 días

### Día 1 — Setup y UI estática
- Configurar el proyecto React (Vite).
- Instalar librería de mapas (Leaflet/Mapbox) y el cliente de Socket.IO.
- Construir el layout general (sidebar + área de mapa) con datos mock, usando como referencia el diseño de Stitch.
- Revisar junto al Backend Developer el contrato de la API que se va a consumir.
- **Entregable:** dashboard navegable con datos de ejemplo (sin conexión real todavía).

### Día 2 — Login y estructura
- Conectar el login del panel admin al endpoint real de autenticación.
- Dejar preparada la estructura de las vistas: Mapa en vivo, Camiones, Conductores, Historial.
- **Entregable:** login funcional contra el backend; navegación completa entre vistas (con datos mock donde falte el backend).

### Día 3 — Lista de camiones en línea
- Consumir `GET /trucks/live` para mostrar la lista inicial de camiones en línea en el sidebar (placa, estado).
- Dejar la estructura del mapa lista para recibir actualizaciones en tiempo real.
- **Entregable:** lista de camiones activos visible y actualizada al cargar la página.

### Día 4 — Tiempo real en el mapa
- Conectar el cliente de Socket.IO para escuchar el evento `truck:update` y mover los marcadores de camiones en tiempo real (RF09, RF10).
- Dibujar la ruta planificada (`rutaPlaneada`) cuando exista, o el breadcrumb de pings recorridos cuando no (RF11, RF12).
- **Entregable:** demo end-to-end — el mapa refleja en tiempo real lo que envía la app del conductor.

### Día 5 — Detalle, historial e integración
- Implementar el panel de detalle al hacer clic en un camión: velocidad, conductor asignado, tiempo activo (RF13).
- Implementar la vista de historial de viajes, consumiendo los filtros de `GET /trips?truckId=&driverId=&from=&to=` (RF14).
- Participar en las pruebas de integración: validar que el mapa se comporte bien con varios camiones simultáneos y con casos límite (pérdida de conexión de un camión, camión sin ruta).
- Ajustes visuales finales para que coincida con el diseño de Stitch.
- **Entregable:** panel administrador estable y listo para la demo.
