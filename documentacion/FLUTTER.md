# Flutter: web y Android

## Entorno preparado

- Flutter 3.47.5 estable y Dart 3.13.4.
- SDK Flutter: `C:\Users\jciri\develop\flutter` (fuera de OneDrive).
- SDK Android: `%LOCALAPPDATA%\Android\Sdk`.
- Android API 36, Build Tools 36.0.0, Platform Tools, NDK 28.2.13676358 y CMake 3.22.1.
- Java 17 configurado para Flutter y licencias Android aceptadas.
- Extensiones Flutter y Dart instaladas en VS Code.
- Proyecto `appmovil/` generado con destinos `web` y `android`.

## Ejecutar en web

Abrir una terminal nueva para cargar el PATH actualizado. Desde la raiz:

```powershell
.\scripts\run-flutter-web.cmd
```

O desde `appmovil`:

```powershell
flutter pub get
flutter run -d chrome --web-port 8080
```

Si el puerto 8080 esta ocupado, detener la instancia previa o elegir otro con
`--web-port 8081`. Para servir sin abrir Chrome:

```powershell
flutter run -d web-server --web-hostname 127.0.0.1 --web-port 8080
```

Abrir http://127.0.0.1:8080. Detener con `q` en la terminal de Flutter.
En VS Code, abrir la raiz y seleccionar `App movil - Flutter Web` en Ejecutar y depurar.
Reiniciar VS Code si todavia no detecta el SDK o las extensiones.

## Verificaciones

```powershell
flutter doctor
flutter analyze
flutter test
```

La advertencia por Visual Studio solo corresponde a aplicaciones de escritorio
Windows. No impide trabajar con los destinos web y Android de este proyecto.

## Alcance

Se preparo la app base de Flutter: todavia muestra el ejemplo inicial del contador.
Los flujos de login, QR, viajes y GPS siguen pendientes de implementacion.
No se genero APK ni AAB, ni se ejecuto una compilacion Android.
La configuracion Android usa por ahora el identificador de ejemplo
`com.example.control_vehicular` y la firma de desarrollo del proyecto generado;
antes de publicar se deben definir identificador definitivo y firma de distribucion.
No se instalo un emulador: el desarrollo actual se realiza en web.

El navegador no garantiza ubicacion continua en segundo plano con pantalla apagada.
Ese comportamiento debe implementarse y validarse en Android con sus permisos.
El requisito iOS permanece pendiente de configuracion y validacion en su plataforma.

## Referencias

- https://docs.flutter.dev/install/manual
- https://docs.flutter.dev/platform-integration/web/setup
- https://docs.flutter.dev/platform-integration/android/setup
