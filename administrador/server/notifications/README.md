# Notificaciones, SOS y recuperación de contraseña

Next.js 16.3.6 / App Router, MongoDB nativo y autenticación existente. Sin nuevas dependencias. EmailJS se consume exclusivamente desde servidor.

## Configurar exactamente dos plantillas

Completa `.env.local` y las variables de producción en Vercel, y vuelve a desplegar:

```dotenv
EMAILJS_SERVICE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
EMAILJS_NOTIFICATION_TEMPLATE_ID=
EMAILJS_EMERGENCY_TEMPLATE_ID=
NEXT_PUBLIC_APP_URL=https://controlvehicular-owwh.vercel.app
```

`EMAILJS_TEMPLATE_ID` se reemplazó por `EMAILJS_NOTIFICATION_TEMPLATE_ID`. Solo la URL es pública. La implementación exige clave privada y genera enlaces desde esta URL, nunca desde Host, Origin o URLs proporcionadas por el cliente.

En EmailJS conecta el servicio en **Email Services**, crea dos plantillas en **Email Templates** y copia sus IDs. Obtén las claves en **Account** y habilita solicitudes de aplicaciones que no son navegador en **Account / Security**. Usa un remitente autorizado; no añadas destinatarios fijos, CC, BCC ni respuestas automáticas.

| Campo | Notificaciones | Emergencia |
| --- | --- | --- |
| To Email | `{{to_email}}` | `{{to_email}}` |
| Subject | `{{subject}}` | SOS · Emergencia · `{{vehicle_plate}}` |
| Título | `{{title}}` | Emergencia SOS |
| Mensaje | `{{message}}` | `{{driver_name}}` |
| Detalles | `{{details}}` | `{{vehicle_plate}}`, `{{location}}`, `{{event_date}}` |
| Botón | `{{button_text}}` con enlace `{{action_url}}` | Opcional: enlace fijo al panel |

Ejemplo de cuerpo para la primera plantilla:

```html
<h1>{{title}}</h1>
<p>{{message}}</p>
<div style="white-space:pre-wrap">{{details}}</div>
<p><a href="{{action_url}}">{{button_text}}</a></p>
```

Usa dos llaves para escapar contenido, nunca tres. La primera plantilla también sirve para verificación del destinatario, pruebas e informe de configuración. La segunda se usa exclusivamente para SOS.

Referencias oficiales: [API REST](https://www.emailjs.com/docs/rest-api/send/), [variables de plantilla](https://www.emailjs.com/docs/user-guide/dynamic-variables-templates/), [configuración de solicitudes desde servidor](https://github.com/emailjs-com/emailjs-nodejs/blob/main/README.md).

## Reglas e integración

- **Exceso:** pares de GPS con los filtros del mapa, límite configurado y exclusión adicional de velocidades mayores de 300 km/h. Un incidente al comenzar cada episodio. Volver al límite o por debajo lo termina; cambiar el límite o interrumpirse datos reinicia evaluación.
- **Menos de 5 km/h:** 30 minutos consecutivos de pares válidos, un aviso por episodio. Velocidad de 5 o más, calidad dudosa o huecos mayores de 30 segundos reinician el conteo. Ausencia de GPS no significa vehículo parado.
- **Datos atrasados:** evaluación automática de puntos nuevos de los últimos dos minutos en viajes activos. No se generan avisos actuales desde archivos offline antiguos ni viajes finalizados. Se conserva la convención Guatemala de las fechas GPS; tokens/cuotas/correos usan UTC real.
- **SOS:** botón con confirmación en Flutter. El servidor exige viaje propio activo y registra antes de intentar el correo. Reintentos devuelven el mismo SOS abierto. Tras marcarlo atendido puede crearse otro, con al menos un minuto entre incidentes. Incluye último GPS del servidor con fecha o indica que no existe ubicación.
- **Atención:** aviso de SOS sin atender en todas las páginas del panel; Notificaciones muestra hasta 100 incidentes y permite marcar atención. Consulta cada 15 segundos. El conductor debe contactar también por teléfono: correo o registro no equivalen a asistencia confirmada.
- **Recuperación:** `/recuperar` para ambos roles; acceso desde login del panel y enlace copiable en Flutter. Usa correo de la cuenta, independiente del destinatario e interruptor administrativo. Token aleatorio de 32 bytes, hash SHA-256, caducidad de 15 minutos y consumo atómico de un solo uso. `/restablecer` exige 12–128 caracteres, usa scrypt e invalida sesiones anteriores de ambos roles. El token viaja en el fragmento del enlace y se retira de la barra al abrirlo.

## Persistencia, límites y operación

- `notificationSettings`: destinatario verificado, estado, revisión, autor y fecha. Código de verificación de seis dígitos, diez minutos y cinco intentos.
- `trips.notificationState`: cursor y episodios, guardados con los incidentes en una transacción MongoDB; requiere replica set como Atlas.
- `notificationIncidents`: bandeja duradera, clave única `_id`, prioridad SOS, estado de correo y atención.
- `notificationDeliveries`: auditoría de pruebas/reportes manuales.
- `notificationSendLimits` y `notificationGates`: cuotas atómicas compartidas entre instancias.
- `users.passwordReset`: hash y caducidad, nunca contraseña ni token sin hash.

Pings, SOS y consultas del panel disparan trabajo con `after()` de Next.js. Flutter no espera a EmailJS para recibir confirmación del GPS. Cada despacho reclama un correo pendiente con prioridad SOS. Los pendientes por cuota/configuración vuelven a evaluarse al recibir GPS o consultar el panel. **No se desplegó un cron**: sin actividad no se garantiza avance de la cola. Para despacho independiente se necesita un trabajador programado autenticado; no abrir una API pública de envío. Mantener el panel supervisado para atender emergencias.

Cuotas rutinarias/pruebas: un intento por minuto, 20 por día UTC. Recuperación: cupo separado de 20/día, uno/minuto y cinco minutos por cuenta; solicitud pública limitada globalmente a una cada diez segundos. SOS no consume el cupo rutinario. Todos comparten separación mínima de 1,1 segundos para EmailJS. Cambiar destinatario no reinicia cuotas. El correo administrativo se consulta y revalida antes de enviar; exige habilitación y verificación.

Estados: `pending`, `sending`, `accepted`, `unconfirmed`. Aceptación no garantiza entrega. Un fallo/timeout tras iniciar el intento no se reenvía automáticamente para evitar duplicados. Un proceso interrumpido puede dejar `sending`: revisar en EmailJS, nunca asumir que no salió. No se puede retirar correo ya enviado al proveedor. No se imprimen respuestas completas del proveedor ni secretos.

Índices recomendados al crecer: `notificationIncidents({mail:1,nextAttempt:1,priority:-1,createdAt:1})`, `notificationIncidents({acknowledgedAt:1,priority:-1,createdAt:-1})` y un índice parcial de `users.passwordReset.hash`. No se crearon índices ni registros reales en Atlas durante pruebas.

## Endpoints

| Ruta | Autorización / cuerpo |
| --- | --- |
| GET `/api/settings/email` | Administrador; configuración y disponibilidad de plantillas |
| PUT `/api/settings/email` | Administrador; `{email,enabled,revision}`; null solo al crear |
| POST `/api/settings/email/verification` | Administrador; `{revision}` |
| POST `/api/settings/email/verify` | Administrador; `{revision,code}` |
| POST `/api/notifications/test` | Administrador; `{revision}` |
| POST `/api/notifications/send` | Administrador; `{revision,reportType:"notification-status"}` |
| GET `/api/notifications/incidents` | Administrador; incidentes recientes |
| POST `/api/notifications/incidents` | Administrador; `{id}` para marcar atendido |
| POST `/api/trips/:id/sos` | Bearer del conductor; viaje propio activo |
| POST `/api/auth/password/forgot` | Público, mismo origen; `{email}`, respuesta genérica |
| POST `/api/auth/password/reset` | Público, mismo origen; `{token,password}` |

Mutaciones del panel exigen mismo origen; consultas sin caché. Ningún endpoint acepta destinatarios/enlaces arbitrarios. `sendReportNotification({subject,message,reportType})` sigue disponible; `sendNotification` y `sendEmergency` son transportes internos que requieren autorización/cuotas del llamador.

## Verificar

Desde `administrador`: `node --test scripts/*.test.mjs`, `npm.cmd run lint`, `npm.cmd run build`. Desde `appmovil`: `flutter analyze --no-pub`, `flutter test --no-pub`. No generar APK/AAB.

Tests con MongoDB y EmailJS simulados: reglas, concurrencia, duplicados, plantillas/destinatarios, permisos, errores, cuotas y tokens. Para verificar entrega real: configura proveedor/plantillas, guarda y verifica destinatario, envía prueba y revisa entrada/spam; comprueba recuperación con tu propia cuenta. Usa datos simulados para probar exceso, nunca provoques uno en carretera. Comprueba persistencia tras reiniciar contra tu Atlas. No se afirma entrega real a partir de pruebas simuladas.

Archivos principales: `server/notifications/{emailjs,service,repository,rate,incident-rules,incidents}.ts`, `server/auth/password-reset.ts`, rutas de la tabla, `components/{incident-feed,password-recovery,email-settings-form}.tsx`, páginas `/notificaciones`, `/recuperar`, `/restablecer`, layout/login del panel y `appmovil/lib/{trip_home_page,login_page,core/api_client,core/trip_tracker}.dart`.
