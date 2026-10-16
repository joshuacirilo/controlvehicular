# Configuracion privada del servidor

Las credenciales locales viven en administrador/.env.local, excluido de Git.
Para otro equipo, copiar administrador/.env.example a administrador/.env.local
 y completar MONGODB_URI. En producción usar los secretos del hosting.

Consumir getMongoConfig() de server/env.ts exclusivamente desde codigo servidor.
El marcador server-only impide importarlo en componentes cliente de Next.js.
No pasar el objeto devuelto a componentes cliente, respuestas HTTP ni logs.
No usar NEXT_PUBLIC_, next.config env, assets Flutter ni --dart-define para secretos.
Flutter solo debe recibir la URL publica de la API; no las credenciales de Atlas.

El modulo env.ts solo carga configuracion; no implementa autenticacion ni endpoints.
Los permisos del usuario Atlas deben limitarse a trucks_db desde Atlas;
esta tarea no modifica usuarios ni infraestructura remota.

## Comprobar conexión a Atlas

Desde administrador ejecutar `npm run db:check`. El comando carga .env.local,
abre una conexión con el driver oficial, envia ping y cierra la conexión.
No modifica datos ni imprime credenciales. Un ping exitoso no demuestra permisos
de lectura/escritura ni que las colecciones esten creadas.

## Login temporal local

Ambas interfaces consumen POST /api/auth/login con JSON {username, password}.
Usuario de prueba: `prueba1`; contraseña: `123`. El archivo server/auth/test-users.json
contiene el usuario y un hash scrypt de la contraseña. Nunca se sirve al cliente.
La respuesta solo contiene mode=test y datos publicos del usuario.
Esto valida credenciales y conectividad, no crea una sesión, token ni permisos.
Se deshabilita fuera de NODE_ENV=development y en Vercel. No depende de Atlas.
Cuando llegue la integracion real, sustituir el proveedor de usuarios y agregar
sesiónes, autorizacion y protecciones del login antes de producción.
