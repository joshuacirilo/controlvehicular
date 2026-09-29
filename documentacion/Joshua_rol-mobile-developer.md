# Rol: Mobile Developer

Responsable de: la app del conductor en Flutter (Dart), con ejecución web y destino Android — escaneo de QR, envío de GPS, UX en campo.

## Requerimientos que implementa

**Funcionales**
- RF03, RF07 — Escaneo de QR para iniciar y finalizar un viaje.
- RF05 — Envío periódico automático de la ubicación GPS mientras el viaje está activo.
- RF16 — Login del conductor (consumo del endpoint de autenticación).

**No funcionales**
- RNF06 — Usabilidad: mínimo de toques posible (idealmente 1-2 para iniciar/finalizar).
- RNF07 — Compatibilidad con Android e iOS.
- RNF10 — Si se pierde conexión, guardar los pings localmente y reintentar el envío al recuperar señal.
- RNF11 — Balancear el intervalo de envío de ubicación entre precisión y consumo de batería/datos.

## Plan de 5 días

### Día 1 — Setup y UI estática
- Configurar el proyecto Flutter para web y Android.
- Definir la navegación: Login → Home → Viaje activo.
- Construir la UI estática con datos mock, usando como referencia el diseño generado en Stitch.
- Revisar junto al Backend Developer el contrato de la API que se va a consumir.
- **Entregable:** app navegable con pantallas estáticas (sin conexión real todavía).

### Día 2 — Login y cámara
- Conectar la pantalla de login al endpoint real de autenticación en cuanto esté disponible (o mock mientras tanto).
- Integrar un plugin Flutter de lectura QR compatible con web y Android para la lectura de códigos QR (funcional, aunque el backend de trips aún no esté listo).
- **Entregable:** login funcional contra el backend; escáner de QR operativo localmente.

### Día 3 — Flujo de viaje
- Conectar el escaneo de QR real a `POST /trips/start`.
- Implementar el envío periódico de ubicación con un plugin Flutter de geolocalización compatible con web y Android hacia `POST /trips/:id/ping`.
- Construir la pantalla "Viaje activo": velocidad actual y tiempo transcurrido en vivo.
- **Entregable:** un conductor puede iniciar un viaje real desde su celular y ver sus datos en pantalla.

### Día 4 — Manejo de errores y background
- Implementar manejo de errores: QR inválido, camión ya con trip activo, pérdida de conexión.
- Implementar cola local (ej. persistencia local compatible con Flutter) para guardar pings no enviados y reintentar al recuperar conexión (RNF10).
- Trabajar en el permiso de ubicación en background (para que el envío de GPS siga funcionando con la pantalla apagada) — la parte más delicada, especialmente en iOS.
- Conectar el escaneo final de QR a `POST /trips/:id/end`.
- **Entregable:** flujo completo de inicio-a-fin funcionando, incluso con cortes de conexión.

### Día 5 — Pulido e integración
- Pulir la UX general (tiempos de carga, feedback visual al escanear, mensajes de error claros).
- Ajustar el manejo de permisos de ubicación en background si quedó pendiente del día 4.
- Participar en las pruebas de integración: probar con varios celulares a la vez, validar que el panel admin refleje correctamente lo que hace la app.
- Ajustes visuales finales para que coincida con el diseño de Stitch.
- **Entregable:** app estable y lista para la demo.

## Entorno Flutter

Consultar `FLUTTER.md` para instalar y ejecutar. El arranque actual prioriza web y prepara Android sin generar APK/AAB. La ubicación en segundo plano debe validarse en Android: una pestaña web no garantiza pings continuos con la pantalla apagada. El soporte iOS queda pendiente de su configuración y validación específicas.
