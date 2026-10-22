# Control de velocidad promedio

`/control` permite a administradores activos guardar una velocidad promedio de
referencia manual, entre 0.1 y 300 km/h con hasta un decimal. Se usa como límite
para evaluar tramos en Camiones; no impone restricciones al vehículo.

`GET /api/control` devuelve la configuración actual o `null` si aún no existe.
`PUT /api/control` recibe `{ "velocidadPromedio": 100 }`. Ambos requieren sesión de
administrador; PUT exige el mismo origen. Las respuestas no se almacenan en caché.
El autor se obtiene de la sesión, nunca del cuerpo enviado por el navegador.

La colección nueva `speedControls` se crea al primer guardado exitoso. Contiene:

- Un documento `_id: "actual"`, `tipo: "actual"`, con la configuración vigente.
- Un documento de ID UUID y `tipo: "cambio"` por guardado, conservado como historial.

Cada documento incluye `velocidadPromedio`, `fechaModificacion`, `modificadoPor`,
`velocidadAnterior` y `autorAnterior`. Los autores contienen ID, usuario y nombre
copiados al guardar. En el primer registro, los dos campos anteriores son `null`.
La fecha es BSON Date en UTC y se presenta en hora de Guatemala en la pantalla.

El valor actual y su historial se escriben en una transacción MongoDB, utilizando
el documento actual para coordinar modificaciones concurrentes. Se requiere un
replica set o un clúster compatible con transacciones, como Atlas. No se crean
índices adicionales ni se cambian validadores de otras colecciones.

Pruebas desde `administrador/`: `node --test scripts/speed-control.test.mjs`.
Usan persistencia simulada; no verifican la conectividad ni transacciones reales
en Atlas. La interfaz muestra el cambio vigente y su antecedente; no ofrece una
lista completa del historial.

## Tramos sobre el límite en Camiones

La API de historial obtiene el límite vigente una vez por página de viajes y añade
`velocidad: { limiteKmh, evaluados, sinEvaluar, excesos }` a cada viaje. Se reevalúan
también viajes históricos contra ese límite actual al cargar sus rutas, sin escribir
infracciones en la base. Cada tramo es un par de checkpoints consecutivos: distancia
Haversine dividida por el tiempo, expresada en km/h. Se descartan de esta evaluación
extremos dudosos, precisión ausente o mayor de 50 m, tiempos inválidos, intervalos
menores de 1 s o mayores de 30 s. El movimiento dentro de la precisión GPS cuenta
como velocidad cero. No se eliminan puntos ni se modifica la distancia del viaje.

Cada exceso conserva los índices `inicio` y `fin` de la ruta y `velocidadKmh` sin
redondear; solo la presentación usa dos decimales. La comparación es estrictamente
mayor que el límite. Tramos consecutivos sobre el límite se cuentan por separado.
La tarjeta muestra el conteo y cobertura. En el diálogo, una lista permite resaltar
en rojo y enfocar cada segmento; «Ver recorrido completo» restaura el encuadre.
Sin límite o sin muestras válidas se informa explícitamente, sin asumir cumplimiento.

Pruebas del cálculo: `node --test scripts/route-speed.test.mjs`.
