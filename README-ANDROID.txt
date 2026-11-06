CUPISSA DOMIS — PREPARACIÓN ANDROID PRIVADA

Esta carpeta conserva la aplicación web original y su conexión con el proyecto Supabase que indicó la propietaria. No crea un proyecto nuevo ni modifica tablas.

QUÉ QUEDA CONFIGURADO
- URL y anon public key integradas en el código: el domiciliario ya no ve una pantalla para introducirlas.
- La pantalla de acceso sigue usando Supabase Auth y el perfil existente.
- Se mantienen las consultas y escrituras actuales sobre profiles, orders, settings, locations, shifts y order_costs.
- Se mantiene el mapa Leaflet/OpenStreetMap y las rutas OSRM.
- En Android, la cámara usa Camera nativa con dirección trasera.
- Se integra el plugin comunitario gratuito de geolocalización en segundo plano.
- Se configura CapacitorHttp para que las solicitudes REST/Auth de Supabase usen HTTP nativo en Android y no dependan del fetch del WebView limitado en segundo plano.
- Se activa android.useLegacyBridge, recomendado por el plugin para evitar que las actualizaciones de ubicación se detengan tras unos minutos.

IMPORTANTE SOBRE EL APK Y EL GPS
Este paquete es el código fuente preparado para compilar. No contiene un APK final firmado ni un keystore. En este entorno no se pudieron instalar las dependencias npm ni está disponible Android SDK/Android Studio para generar y probar el APK en un dispositivo. No se debe distribuir hasta completar la compilación y las pruebas reales.

PASOS EN UN PC CON ANDROID STUDIO Y ANDROID SDK
1. Instalar Node.js 20+ y Android Studio con Android SDK Platform y Build Tools.
2. En Windows, hacer doble clic en PREPARAR_ANDROID_WINDOWS.bat. El script instala dependencias, construye la web, crea android/ si falta y sincroniza Capacitor.
3. Revisar android/app/src/main/AndroidManifest.xml e incorporar los permisos del archivo AndroidManifest-permissions.xml sin reemplazar el manifiesto generado.
4. Ejecutar: npx cap sync android
5. Si el plugin no incorpora automáticamente el nombre del canal, copiar las cadenas de public/strings.xml.example a android/app/src/main/res/values/strings.xml (sin borrar otras cadenas).
6. Abrir con: npx cap open android
7. En Android Studio, compilar primero un APK de prueba y probarlo en un Android real.
8. Para distribución privada, generar un APK release firmado y guardar el keystore de firma de forma segura. Todas las actualizaciones futuras deben firmarse con la misma clave.

PERMISOS ANDROID
- Cámara.
- Ubicación precisa.
- Ubicación en segundo plano.
- Servicio en primer plano de tipo ubicación.
- Notificaciones (para mostrar el seguimiento activo).

PRUEBA OBLIGATORIA ANTES DE ENTREGAR A DOMICILIARIOS
- Iniciar sesión con una cuenta courier ya existente.
- Iniciar jornada y aceptar permisos.
- Verificar que Android muestra notificación persistente de ubicación.
- Apagar pantalla 15 minutos y comprobar desde el panel administrador que locations.updated_at sigue avanzando.
- Probar en los modelos Android reales de la empresa.
- Terminar jornada y comprobar que deja de enviar ubicaciones.

LIMITACIONES
Android puede detener el seguimiento si el usuario fuerza la detención, desactiva GPS, revoca permisos o restringe batería. La integración usa el plugin comunitario y HTTP nativo; aun así, el comportamiento exacto del servicio, permisos y sincronización debe comprobarse con el APK instalado. No se afirma que el GPS en pantalla apagada esté validado hasta completar la prueba anterior.

SEGURIDAD
La anon public key está diseñada para uso en cliente, pero no es una clave privada. La seguridad depende de RLS y permisos de Supabase. Nunca incorporar service_role ni contraseñas administrativas al APK.


PUBLICACIÓN EN domis.cupissa.com
- Ejecutar npm run build.
- Subir el CONTENIDO de la carpeta dist (no la carpeta dist como subcarpeta) al directorio raíz asignado al subdominio domis.cupissa.com en Hostinger.
- El APK release firmado debe publicarse como archivo descargable en ese mismo dominio (por ejemplo, /app/CUPISSA-DOMIS.apk) y enlazarse desde una página de descarga. No se publica automáticamente desde este ZIP.
