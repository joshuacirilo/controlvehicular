# Administrador: instalar y levantar el sitio web

Guia para una persona o un agente de IA que prepare el proyecto en otra computadora. El sitio utiliza **Next.js con App Router, React, TypeScript y Tailwind CSS**. Los comandos principales funcionan en Windows, macOS y Linux.

## Instrucciones para el agente

- Leer `../AGENTS.md` y `AGENTS.md` de esta carpeta antes de trabajar.
- Reutilizar el proyecto existente: no ejecutar `create-next-app` ni reemplazar el codigo.
- Preservar cambios locales y archivos de bloqueo. No actualizar dependencias como parte de la instalacion.
- Instalar las herramientas que falten, restaurar dependencias, ejecutar las verificaciones y comprobar el sitio en el navegador.
- Esta tarea prepara el entorno local; no autoriza despliegues ni publicaciones.
- No copiar rutas de la computadora original ni sus carpetas `node_modules/` o `.next/`.

## 1. Requisitos

| Herramienta | Referencia del entorno original |
| --- | --- |
| Node.js | 24.19.0 |
| npm, incluido con Node.js | 11.17.0 |
| Next.js, instalado por el proyecto | 16.3.6 |
| React y React DOM, instalados por el proyecto | 19.2.8 |

Para reproducir el entorno, usar Node.js 24.19.0 con npm 11.17.0. El paquete Next.js instalado declara Node.js `>=20.9.0` como minimo, pero eso no significa que todas esas versiones se hayan validado aqui.

Descargar Node.js desde [su sitio oficial](https://nodejs.org/en/download) o instalar esa version con el gestor de versiones disponible en el equipo. Instalar Git si se va a clonar el repositorio. Tener un navegador y conexion a internet para descargar dependencias y las fuentes Google utilizadas por `next/font/google`.

Despues de instalar Node.js, abrir una terminal nueva:

```sh
node --version
npm --version
```

No hace falta instalar Next.js, React, TypeScript ni Tailwind globalmente. No se necesita Flutter, Android Studio, Java ni Docker para levantar este sitio.

## 2. Abrir el proyecto e instalar dependencias

Clonar el repositorio usando la URL proporcionada por el equipo, o abrir una copia existente. Desde la raiz de `controlvehicular`:

```sh
cd administrador
npm ci
```

**Ejecutar los comandos npm dentro de `administrador`.** `npm ci` instala las dependencias de `package-lock.json`, incluyendo las herramientas de desarrollo. No usar `--omit=dev`.

Existen `package-lock.json` y `pnpm-lock.yaml`. Esta guia utiliza **npm y package-lock.json** para reproducir la instalacion. No alternar gestores, regenerar los bloqueos ni borrar el bloqueo alternativo durante este procedimiento. Si el equipo decide adoptar pnpm, coordinar primero esa decision.

Si `npm ci` informa que `package.json` y `package-lock.json` no coinciden, detenerse y reportar la inconsistencia; no resolverla automaticamente con `npm install`, `--force` o una actualizacion de paquetes.

### PowerShell bloquea npm.ps1

Usar el ejecutable `.cmd`, sin cambiar la politica de ejecucion de Windows:

```powershell
npm.cmd --version
npm.cmd ci
```

Aplicar el mismo cambio a los comandos siguientes: `npm.cmd run dev`, por ejemplo.

## 3. Variables de entorno y servicios externos

En el codigo actual no hay variables de entorno obligatorias, llamadas a una API ni conexion a base de datos. **No hace falta crear `.env.local` ni iniciar un backend para ver la pagina inicial.**

El sitio conserva la plantilla inicial de Next.js. Login, mapas, datos de camiones e integracion con el backend siguen pendientes; levantar la plantilla no valida esas funcionalidades.

Si el codigo cambia en el futuro, revisar las variables realmente consumidas y solicitar al equipo sus valores. No inventar credenciales ni exponer secretos mediante variables `NEXT_PUBLIC_*`.

## 4. Levantar el sitio en desarrollo

Desde `administrador`:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abrir **http://127.0.0.1:3000** y esperar la primera compilacion. Verificar que se muestra la pagina y que la terminal no presenta errores. Mantener la terminal abierta; detener con `Ctrl+C`.

Si el puerto 3000 esta ocupado:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Abrir http://127.0.0.1:3001. No detener procesos ajenos para liberar el puerto.

La pagina principal esta en `app/page.tsx`, el layout en `app/layout.tsx` y los estilos globales en `app/globals.css`. Next.js actualiza la vista al guardar cambios.

## 5. Verificar la instalacion

```sh
npm run lint
npm run build
```

Revisar el resultado de cada comando. El proyecto no tiene un script `npm test`: no reportar pruebas automatizadas inexistentes.

Para comprobar el modo produccion local, primero detener el servidor de desarrollo y ejecutar, despues de un build exitoso:

```sh
npm run start -- --hostname 127.0.0.1 --port 3000
```

`npm run start` necesita el resultado de `npm run build`. Estos comandos no despliegan el sitio. Evitar ejecutar `dev` y `build` simultaneamente sobre la misma copia mientras se verifica la instalacion.

Si solo se necesita trabajar en desarrollo, `npm run dev` basta; el build sirve como comprobacion adicional antes de entregar el entorno.

## Problemas habituales

- **Node o npm no se reconocen:** reabrir terminal y editor, comprobar el PATH y la instalacion de Node.js.
- **Error ENOENT sobre package.json:** comprobar que la terminal esta dentro de `administrador`.
- **Error descargando Geist o Geist Mono:** `app/layout.tsx` utiliza `next/font/google`; comprobar acceso a Google Fonts y la configuracion del proxy. No desactivar la validacion TLS ni cambiar fuentes solo para ocultar el problema.
- **Error de descarga de npm:** verificar acceso a `registry.npmjs.org`, conexion y proxy. No ejecutar `npm audit fix --force` como solucion de instalacion.
- **Bloqueo de otra instancia Next.js:** detener unicamente la instancia propia anterior y reintentar. No borrar `.next` mientras el servidor este activo.
- **Dependencias nativas incompatibles:** no reutilizar `node_modules` de otro sistema; instalar en el equipo destino con `npm ci`.

## Entrega esperada del agente

Informar:

- Versiones reales de Node.js y npm.
- Resultado de `npm ci`, lint y build; indicar si alguna comprobacion no se ejecuto.
- URL local utilizada y si el servidor sigue activo.
- Resultado de abrir la pagina en el navegador y cualquier bloqueo pendiente.

No declarar que el sitio funciona si solo se instalaron las dependencias.

## Herramientas adicionales y referencias

Graphify es opcional para ejecutar el sitio. Para restaurarlo, consultar [GRAPHIFY.md](../documentacion/GRAPHIFY.md). No copiar su entorno virtual desde otra computadora.

Para cambios de codigo, seguir `AGENTS.md` y consultar las guias que incluye la version instalada de Next.js en `node_modules/next/dist/docs/`. La guia de instalacion esta en `01-app/01-getting-started/01-installation.md`.

- [Node.js](https://nodejs.org/en/download)
- [Next.js](https://nextjs.org/docs)
- [Requerimientos del proyecto](../documentacion/Requerimientos.md)
- [Rol frontend](../documentacion/Ericka_rol-frontend-developer.md)
