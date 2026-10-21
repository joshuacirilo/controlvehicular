# Validación GPS en teléfono

Estado: procedimiento preparado; pendiente de ejecución en un teléfono real.
No generar APK/AAB ni lanzar Android sin levantar la restricción vigente de empaquetado/pruebas Android.

## Comportamiento implementado

- Al entrar o restaurar sesión: verificar ubicación precisa, servicio de ubicación, cámara y notificaciones en Android. Si falta algo, permanecer en la pantalla de permisos.
- Al volver a la app: volver a comprobar permisos; un permiso revocado bloquea el acceso conservando la sesión y el viaje en servidor.
- Inicio: esperar hasta 30 s por una muestra no simulada, con antigüedad entre 0 y 10 s y precisión reportada mayor que 0 y hasta 30 m. No crear el viaje si no se consigue.
- Calidad: buena hasta 20 m, regular hasta 50 m, baja si supera 50 m o es desconocida. Estos umbrales son una política inicial, no una garantía del receptor.
- Alertas: `low_accuracy`, `stale`, `mocked`, `out_of_order`, `gap` (>30 s) y `jump`. El salto se marca cuando, descontando los radios de incertidumbre de ambos puntos, la velocidad implícita supera 160 km/h en un intervalo de hasta 30 s.
- Conservar coordenadas, hora y alertas en SQLite y al transmitir. Las alertas son diagnósticos del dispositivo, no pruebas de manipulación. El panel las muestra como advertencias y conecta todos los checkpoints en orden, incluidos los dudosos, por decisión del usuario.
- Capturar aproximadamente cada 5 s y enviar lotes cada 60 s; el dispositivo y el sistema pueden retrasar muestras. El inicio y el cierre tienen envío inmediato.

## Prueba de campo

Realizarla con un acompañante encargado del teléfono; el conductor no debe operarlo en movimiento.

1. Anotar modelo, versión Android, versión de la app, permiso preciso/aproximado y estado de ahorro de batería.
2. Denegar cada permiso por separado. Verificar que no se accede al módulo. Concederlos desde ajustes y verificar que se permite entrar sin crear una sesión nueva.
3. Probar señal insuficiente al iniciar: el viaje no debe crearse y debe aparecer un mensaje al agotarse la espera. Repetir con buena señal.
4. Recorrer el mismo tramo durante al menos cinco minutos con app visible y cinco con pantalla bloqueada. Anotar las horas reales del bloqueo/desbloqueo.
5. Durante el viaje, abrir **Diagnóstico GPS → Copiar diagnóstico** y guardar el JSON en un archivo. El registro contiene las últimas 360 muestras de esta instancia; copiar antes de finalizar o reiniciar la app. `appState` distingue estado visible/segundo plano, no mide directamente el encendido físico de pantalla.
6. Comparar precisión, intervalos y alertas en ambas fases; correlacionar `pingId` con los checkpoints guardados en la API. Registrar cantidad y porcentaje de muestras con precisión >50 m, intervalos >10 s y huecos >30 s.
7. Cortar internet durante dos minutos. Confirmar que crecen pendientes, recuperar la conexión y verificar entrega sin duplicados ni cambio de timestamps.
8. Terminar antes del minuto de envío: confirmar que se vacía la cola antes de cerrar. Repetir con red interrumpida: el viaje debe seguir activo si quedan pendientes.
9. Revocar ubicación precisa desde ajustes y volver a la app: debe bloquear el acceso; al concederla debe recuperar el viaje activo.

Criterio de evaluación: ninguna pérdida silenciosa ni duplicación; bloqueos por permisos y por mala lectura inicial correctos. La calidad y continuidad con pantalla apagada deben medirse, no darse por aprobadas mediante tests de escritorio.

## Límites

El diagnóstico copiable está en memoria y se reinicia al crear un viaje o reiniciar el proceso; las muestras y sus alertas sí permanecen en SQLite hasta su entrega. El navegador solicita cámara y geolocalización, pero no ofrece los mismos permisos ni garantiza seguimiento con pantalla apagada. No se agregó ajuste automático a calles.
