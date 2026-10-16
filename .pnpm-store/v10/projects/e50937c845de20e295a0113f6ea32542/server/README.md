# Configuracion privada del servidor

Las credenciales locales viven en administrador/.env.local, excluido de Git.
Para otro equipo, copiar administrador/.env.example a administrador/.env.local
 y completar MONGODB_URI. En produccion usar los secretos del hosting.

Consumir getMongoConfig() de server/env.ts exclusivamente desde codigo servidor.
El marcador server-only impide importarlo en componentes cliente de Next.js.
No pasar el objeto devuelto a componentes cliente, respuestas HTTP ni logs.
No usar NEXT_PUBLIC_, next.config env, assets Flutter ni --dart-define para secretos.
Flutter solo debe recibir la URL publica de la API; no las credenciales de Atlas.

Esta configuracion no abre una conexion ni implementa autenticacion o endpoints.
Los permisos del usuario Atlas deben limitarse a trucks_db desde Atlas;
esta tarea no modifica usuarios ni infraestructura remota.
