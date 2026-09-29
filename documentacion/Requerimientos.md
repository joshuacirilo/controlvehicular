Gestión de camiones y conductores

RF01: El sistema debe permitir registrar camiones con su placa y un código QR único asociado.
RF02: El sistema debe permitir registrar conductores con sus datos básicos (nombre, licencia).

App del conductor

RF03: El conductor debe poder escanear el QR del camión para iniciar un viaje (trip).
RF04: El sistema debe rechazar el inicio de un viaje si el camión ya tiene un trip activo.
RF05: Mientras el trip esté activo, la app debe enviar la ubicación GPS del dispositivo periódicamente (cada 5-10s).
RF06: El sistema debe calcular y registrar la velocidad del camión en cada envío de ubicación.
RF07: El conductor debe poder escanear el QR nuevamente para finalizar el viaje.
RF08: El sistema debe cerrar el trip y detener el envío de ubicación al finalizar.

Panel administrador

RF09: El administrador debe poder ver un mapa en tiempo real con todos los camiones actualmente en línea (trip activo).
RF10: El sistema debe actualizar la posición de los camiones en el mapa sin necesidad de recargar la página.
RF11: Si el trip tiene una ruta planificada, el sistema debe dibujarla en el mapa.
RF12: Si el trip NO tiene ruta planificada, el sistema debe mostrar el recorrido real (rastro de puntos) que el camión ha hecho.
RF13: El administrador debe poder seleccionar un camión y ver su velocidad actual y detalles del trip.
RF14: El administrador debe poder consultar el historial de trips pasados de un camión o conductor.
RF15: El administrador debe poder ver una lista de camiones con su estado (en línea/fuera de línea).

Autenticación

RF16: El sistema debe autenticar a los conductores y administradores antes de dar acceso a sus respectivas interfaces.
Requerimientos No Funcionales (RNF)
RNF01 (Rendimiento): La actualización de posición en el panel admin no debe tardar más de 3-5 segundos desde que el conductor envía el ping.
RNF02 (Escalabilidad): La base de datos y el backend deben soportar el crecimiento en número de camiones y frecuencia de pings sin degradar el rendimiento (índices geoespaciales en MongoDB).
RNF03 (Disponibilidad): El sistema debe estar disponible al menos el 99% del tiempo durante horario laboral.
RNF04 (Seguridad): Las comunicaciones entre app móvil, backend y panel admin deben ir cifradas (HTTPS/WSS).
RNF05 (Seguridad): El acceso a los datos de ubicación debe estar restringido por autenticación/autorización basada en roles (conductor vs. administrador).
RNF06 (Usabilidad): La app del conductor debe poder usarse con el mínimo de interacción (idealmente 1-2 toques para iniciar/finalizar).
RNF07 (Compatibilidad): La app del conductor debe funcionar en Android e iOS (Flutter; desarrollo y pruebas iniciales en web, con destino Android preparado).
RNF08 (Mantenibilidad): El backend debe seguir una arquitectura MVC clara, separando modelos (Mongoose), controladores (lógica de endpoints) y rutas.
RNF09 (Portabilidad de datos): El histórico de ubicaciones (pings) debe poder exportarse o consultarse por rango de fechas para auditoría.
RNF10 (Tolerancia a fallos): Si se pierde la conexión del dispositivo móvil momentáneamente, el sistema debe poder reintentar el envío de pings sin perder datos (cola local temporal).
RNF11 (Consumo de batería/datos): El intervalo de envío de ubicación debe balancear precisión con consumo de batería y datos móviles.