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

## Conexion con el backend local

Levantar administrador con `npm run dev` (puerto 3000) y ejecutar
`./scripts/run-flutter-web.cmd` desde la raiz (Flutter web, puerto 8080).
La pantalla comprueba GET /api/health y permite reintentar. No comprueba Atlas.
La plantilla del contador fue reemplazada por esta comprobacion de conexion.

## Recordatorio obligatorio antes de empaquetar

Antes de generar una version de distribucion, recordar al usuario configurar
`--dart-define=API_BASE_URL=https://DOMINIO-REAL.vercel.app/api/`.
La URL definitiva sigue pendiente; no usar el ejemplo como destino real.
En release la aplicacion rechaza URL ausente, HTTP o localhost.
La URL publica no debe contener credenciales. En Vercel configurar
CORS_ALLOWED_ORIGINS con los origenes HTTPS reales del cliente web, separados por comas.
En desarrollo se permiten localhost:8080 y 127.0.0.1:8080.
En un telefono localhost apunta al telefono: estas instrucciones locales son para Chrome en la PC.
No se genero APK/AAB ni se valido Android.

## Login temporal local

La pantalla inicial ahora es un formulario de login. Usar `prueba1` y `123`
con el backend levantado mediante `npm run dev`. Admin usa el mismo endpoint.
La confirmacion indica que el backend valido las credenciales; no existe aun
una sesion persistente ni acceso a datos. Al recargar se vuelve al formulario.

## Acceso con QR de credenciales (prueba local)

En el login seleccionar **Ingresar con QR**, permitir la camara y apuntar al QR.
Contenido exacto de ejemplo: `{"username":"prueba1","password":"123"}`.
Ambos valores deben ser strings. La app valida el formato y envia POST /api/auth/login
a la API configurada; solo muestra exito tras la respuesta del backend.
Un QR malformado permite seguir escaneando; credenciales rechazadas vuelven al login.
La camara se cierra al leer un QR valido o al cancelar. No se guardan credenciales del QR.
En Chrome usar localhost o HTTPS. Ante permiso rechazado, habilitarlo en el navegador
y volver a abrir el escaner. Este QR expone la clave a quien lo lea: solo datos de prueba.
No se verifico la camara fisica ni Android; no se genero APK/AAB.

## Inicio del conductor

Tras login manual o QR se muestra la pantalla con Iniciar viaje y Terminar viaje.
Por ahora ambos botones muestran un aviso de funcion pendiente: no llaman a la API
ni cambian el estado de viajes. El icono superior permite volver al login.
