@echo off
setlocal
cd /d "%~dp0"
echo =============================================
echo CUPISSA DOMIS - PREPARAR PROYECTO ANDROID
echo =============================================
where node >nul 2>nul || (echo ERROR: Instala Node.js 20 o superior. & pause & exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm no esta disponible. & pause & exit /b 1)
echo [1/4] Instalando dependencias...
call npm install
if errorlevel 1 (echo ERROR al instalar dependencias. Revisa internet y vuelve a ejecutar. & pause & exit /b 1)
echo [2/4] Construyendo la aplicacion web...
call npm run build
if errorlevel 1 (echo ERROR en la compilacion web. & pause & exit /b 1)
if not exist "android\app\src\main\AndroidManifest.xml" (
  echo [3/4] Creando proyecto Android...
  call npx cap add android
  if errorlevel 1 (echo ERROR al crear el proyecto Android. & pause & exit /b 1)
) else (
  echo [3/4] Proyecto Android ya existe; se conserva.
)
echo [4/4] Sincronizando Capacitor...
call npx cap sync android
if errorlevel 1 (echo ERROR al sincronizar Android. & pause & exit /b 1)
echo.
echo LISTO. Abriendo Android Studio...
call npx cap open android
pause
