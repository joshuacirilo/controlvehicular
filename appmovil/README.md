# Control Vehicular: instalacion de Flutter para otro agente de IA

Esta guia permite reproducir el entorno en **otra computadora Windows 10/11 de 64 bits**, ejecutar `appmovil` en web y dejar las herramientas de Android preparadas. Para macOS o Linux, adaptar la instalacion de los SDK siguiendo las referencias oficiales; los comandos Flutter del proyecto son los mismos.

## Objetivo y limites

- Trabajar con el proyecto existente en `appmovil/`, con destinos `web/` y `android/`.
- No ejecutar `flutter create` sobre esta carpeta ni reemplazar el codigo existente.
- No generar APK ni AAB: no ejecutar `flutter build apk`, `flutter build appbundle`, tareas Gradle de empaquetado ni `flutter run` contra Android.
- No modificar requisitos funcionales, actualizar dependencias ni agregar funcionalidades como parte de la instalacion.
- Leer primero el `AGENTS.md` de la raiz y respetar los cambios locales del usuario.
- No copiar rutas con el usuario `jciri`: resolver las rutas de la computadora destino.

## Versiones verificadas en el equipo original

| Componente | Version |
| --- | --- |
| Flutter, canal stable | 3.47.5 |
| Dart, incluido con Flutter | 3.13.4 |
| Java JDK | 17 |
| Android Platform | API 36 |
| Android Build Tools | 36.0.0 |
| Android NDK | 28.2.13676358 |
| CMake del SDK Android | 3.22.1 |

Usar Flutter 3.47.5 para reproducir el entorno. No instalar Dart por separado. Mantener `pubspec.lock`; usar `flutter pub get`, no `flutter pub upgrade`. Si una version ya no esta disponible, informar el problema antes de cambiar la version del proyecto.

## 1. Inspeccionar el equipo

Obtener el repositorio con Git o abrir una copia existente. Situarse en su raiz (la carpeta que contiene `appmovil`, `administrador` y `documentacion`). No clonar dentro de `appmovil`.

En PowerShell:

```powershell
Get-Command git, flutter, java, code -ErrorAction SilentlyContinue
Get-ChildItem appmovil -Force
```

Comprobar versiones de las herramientas encontradas. Reutilizar instalaciones compatibles y no sobrescribir SDK existentes. Instalar Git, Chrome y JDK 17 si faltan. VS Code es opcional, pero se recomienda para trabajar con la configuracion incluida.

## 2. Instalar Flutter

Instalar el SDK fuera del repositorio y de carpetas sincronizadas. La ruta sugerida es `%USERPROFILE%\develop\flutter`, siempre que no contenga espacios; si los contiene, elegir otra ruta escribible sin espacios.

Si esa carpeta no existe, descargar la version fijada del repositorio oficial:

```powershell
$flutterSdk = Join-Path $env:USERPROFILE 'develop\flutter'
New-Item -ItemType Directory -Force (Split-Path $flutterSdk) | Out-Null
if (Test-Path $flutterSdk) {
    throw 'La ruta ya existe: comprobar esa instalacion antes de continuar.'
}
git clone --branch 3.47.5 --depth 1 https://github.com/flutter/flutter.git $flutterSdk
if ($LASTEXITCODE -ne 0) { throw 'Fallo la descarga de Flutter.' }
& "$flutterSdk\bin\flutter.bat" --version
```

Alternativa: descargar Flutter 3.47.5 para Windows desde el archivo oficial de versiones y extraerlo en esa ubicacion. Verificar la integridad con el checksum publicado. No descargar ejecutables de terceros.

Agregar el SDK al PATH del usuario, preservando sus entradas actuales:

```powershell
$flutterBin = Join-Path $flutterSdk 'bin'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $flutterBin) {
    [Environment]::SetEnvironmentVariable('Path', "$flutterBin;$userPath", 'User')
}
$env:Path = "$flutterBin;$env:Path"
flutter config --no-analytics --enable-web --enable-android
flutter --version
```

Reabrir las terminales y el editor para que reciban el nuevo PATH. La descarga inicial de Dart y de las herramientas de Flutter puede tardar varios minutos.

## 3. Preparar Android sin empaquetar

La web funciona sin Android SDK, pero completar esta seccion para dejar Android preparado.

1. Instalar JDK 17 si no existe y localizar su directorio real (el que contiene `bin\java.exe`).
2. Descargar **Command line tools for Windows** de la pagina oficial de Android Studio. Verificar el SHA-256 publicado.
3. Extraer y colocar su contenido de modo que exista `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat`. No dejar una carpeta `cmdline-tools` adicional dentro de `latest`.
4. Si Android Studio ya proporciona el SDK, reutilizar esa ruta y habilitar sus Command-line Tools desde SDK Manager.

Configurar las rutas en PowerShell, sustituyendo el ejemplo del JDK por una ruta existente:

```powershell
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$jdkDir = 'C:\RUTA_REAL_DEL_JDK_17'
if (-not (Test-Path "$jdkDir\bin\java.exe")) { throw 'Corregir jdkDir.' }
$env:JAVA_HOME = $jdkDir
$env:ANDROID_HOME = $androidSdk
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $androidSdk, 'User')
flutter config --android-sdk "$androidSdk" --jdk-dir "$jdkDir"
$sdkManager = Join-Path $androidSdk 'cmdline-tools\latest\bin\sdkmanager.bat'
& $sdkManager --licenses
& $sdkManager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;28.2.13676358' 'cmake;3.22.1'
flutter doctor --android-licenses
```

Completar la aceptacion de licencias en la terminal conforme a la autorizacion del usuario. No asumir que un codigo de salida cero significa que se instalaron todos los paquetes: comprobar el resultado con `flutter doctor -v`.

No se necesita emulador para el flujo web. El SDK Android preparado no equivale a una compilacion Android validada: esa comprobacion queda fuera de esta tarea.

## 4. Configurar el editor para este equipo

Si VS Code esta instalado:

```powershell
code --install-extension Dart-Code.flutter
```

La extension instala tambien el soporte Dart. Revisar `.vscode/settings.json` en la raiz: la copia original contiene `dart.flutterSdkPath` apuntando a `C:/Users/jciri/develop/flutter`. Cambiar **solo ese valor** por la ruta del equipo actual, o quitar esa propiedad para que la extension detecte Flutter desde el PATH. Preservar las demas preferencias.

Abrir la raiz del repositorio en VS Code. `.vscode/launch.json` incluye `App movil - Flutter Web` y apunta a `appmovil/lib/main.dart`.

## 5. Restaurar dependencias y validar

Desde la raiz:

```powershell
cd appmovil
flutter pub get
flutter analyze
flutter test
flutter doctor -v
flutter devices
```

Revisar el resultado de cada comando antes de continuar. Criterios de aceptacion:

- Flutter y Dart tienen las versiones esperadas.
- `flutter analyze` termina sin problemas y `flutter test` pasa.
- `flutter doctor -v` reconoce Android, sus licencias y Chrome.
- `flutter devices` muestra Chrome o Edge.
- La advertencia de Visual Studio para escritorio Windows no bloquea web ni Android; no instalar ese entorno solo para eliminarla.

Los archivos locales como `android/local.properties`, `.dart_tool/` y `build/` se regeneran en cada equipo; no copiarlos del anterior ni versionarlos.

## 6. Ejecutar y comprobar la web

Desde `appmovil`:

```powershell
flutter run -d chrome --web-port 8080
```

O, desde la raiz del repositorio:

```powershell
.\scripts\run-flutter-web.cmd
```

El script busca Flutter en `%USERPROFILE%\develop\flutter` y, si no lo encuentra, utiliza el PATH.

Para servir sin abrir el navegador automaticamente:

```powershell
flutter run -d web-server --web-hostname 127.0.0.1 --web-port 8080
```

Abrir http://127.0.0.1:8080 y verificar que carga la interfaz y responde a sus controles. En la app base, el boton `+` incrementa el contador. Mantener el proceso activo mientras se usa la app. `q` detiene Flutter; `r` recarga y `R` reinicia. Si 8080 esta ocupado, usar `--web-port 8081` sin detener procesos ajenos.

## 7. Entrega del agente

Informar las versiones y rutas instaladas, los resultados de analisis y pruebas, la URL y si el servidor sigue activo. Indicar cualquier bloqueo real y confirmar que no se genero APK/AAB. No declarar una validacion exitosa si no se ejecutaron las comprobaciones.

La app base no implementa aun login, QR, viajes ni GPS. El seguimiento continuo en segundo plano debe validarse en Android; una pestaña web no garantiza ese comportamiento. Antes de publicar Android habra que definir identificador definitivo y firma de distribucion.

## Graphify (herramienta adicional del repositorio)

Graphify no es necesario para ejecutar Flutter. Si el agente necesita restaurar tambien esa herramienta, instalar `uv` y ejecutar desde la raiz:

```powershell
.\scripts\install-graphify.cmd
.\graphify.cmd --help
```

Consultar [GRAPHIFY.md](../documentacion/GRAPHIFY.md) y `AGENTS.md` para su uso. No copiar `.venv-graphify` de otra computadora.

## Referencias

- [Instalacion oficial de Flutter](https://docs.flutter.dev/install/manual)
- [Archivo de versiones Flutter](https://docs.flutter.dev/install/archive)
- [Preparacion web](https://docs.flutter.dev/platform-integration/web/setup)
- [Preparacion Android](https://docs.flutter.dev/platform-integration/android/setup)
- [Android SDK Command-line Tools](https://developer.android.com/studio#command-tools)
- [Notas del entorno original](../documentacion/FLUTTER.md)
