@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
	echo Node.js 22.12 ou superior nao foi encontrado.
	echo Instale a versao LTS x64 do Node.js e execute este arquivo novamente.
	pause
	exit /b 1
)

node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||major===22&&minor>=12?0:1)"
if errorlevel 1 (
	echo Esta aplicacao requer Node.js 22.12 ou superior.
	pause
	exit /b 1
)

if not exist node_modules (
	echo Instalando dependencias do Sorteio...
	call npm install
	if errorlevel 1 goto failed
)

echo Preparando a interface web...
call npm run build
if errorlevel 1 goto failed

set "OPEN_BROWSER=1"
call npm start
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Nao foi possivel iniciar o Sorteio. Confira as mensagens acima.
pause