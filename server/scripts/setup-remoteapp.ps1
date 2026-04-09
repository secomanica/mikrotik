# ============================================================
# WebGate RDP - RemoteApp Configuration Script
# ============================================================
# Run as Administrator on the Windows Server
# Configures Windows Remote Desktop Services for RemoteApp support.
# ============================================================

param(
    [switch]$EnableRemoteApp,
    [switch]$AllowUnlisted,
    [string]$AppName,
    [string]$AppPath,
    [string]$AppAlias
)

$ErrorActionPreference = 'Stop'

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  WebGate RDP - Configuracao RemoteApp" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERRO: Execute este script como Administrador!" -ForegroundColor Red
    exit 1
}

$tsAppAllowListPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Terminal Server\TSAppAllowList"

# Ensure the registry path exists
if (-not (Test-Path $tsAppAllowListPath)) {
    New-Item -Path $tsAppAllowListPath -Force | Out-Null
    Write-Host "[OK] Chave de registro TSAppAllowList criada" -ForegroundColor Green
}

if (-not (Test-Path "$tsAppAllowListPath\Applications")) {
    New-Item -Path "$tsAppAllowListPath\Applications" -Force | Out-Null
}

# Enable RemoteApp
if ($EnableRemoteApp) {
    # Enable Remote Desktop
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" `
        -Name "fDenyTSConnections" -Value 0 -Type DWord
    Write-Host "[OK] Remote Desktop habilitado" -ForegroundColor Green

    # Enable RemoteApp
    if ($AllowUnlisted) {
        # Allow all applications (development mode)
        Set-ItemProperty -Path $tsAppAllowListPath -Name "fDisabledAllowList" -Value 1 -Type DWord
        Write-Host "[OK] RemoteApp: Todos os aplicativos permitidos (modo desenvolvimento)" -ForegroundColor Yellow
    } else {
        # Enforce allow list (production mode)
        Set-ItemProperty -Path $tsAppAllowListPath -Name "fDisabledAllowList" -Value 0 -Type DWord
        Write-Host "[OK] RemoteApp: Apenas aplicativos listados (modo producao)" -ForegroundColor Green
    }

    # Configure RDP settings for RemoteApp
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" `
        -Name "fEnableRemoteAppForServer" -Value 1 -Type DWord -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "RemoteApp configurado com sucesso!" -ForegroundColor Green
}

# Register a specific application
if ($AppName -and $AppPath) {
    if (-not $AppAlias) {
        $AppAlias = $AppName -replace '\s+', ''
    }

    # Verify the executable exists
    if (-not (Test-Path $AppPath)) {
        Write-Host "[AVISO] Executavel nao encontrado: $AppPath" -ForegroundColor Yellow
        Write-Host "O registro sera criado, mas verifique o caminho." -ForegroundColor Yellow
    }

    $appRegPath = "$tsAppAllowListPath\Applications\$AppAlias"

    # Create or update the app registration
    if (-not (Test-Path $appRegPath)) {
        New-Item -Path $appRegPath -Force | Out-Null
    }

    Set-ItemProperty -Path $appRegPath -Name "Name" -Value $AppName -Type String
    Set-ItemProperty -Path $appRegPath -Name "Path" -Value $AppPath -Type String
    Set-ItemProperty -Path $appRegPath -Name "CommandLineSetting" -Value 0 -Type DWord
    Set-ItemProperty -Path $appRegPath -Name "RequiredCommandLine" -Value "" -Type String

    Write-Host ""
    Write-Host "[OK] Aplicativo registrado:" -ForegroundColor Green
    Write-Host "  Nome: $AppName"
    Write-Host "  Caminho: $AppPath"
    Write-Host "  Alias: $AppAlias"
}

# Show current configuration
Write-Host ""
Write-Host "--- Aplicativos Registrados ---" -ForegroundColor Cyan
$apps = Get-ChildItem "$tsAppAllowListPath\Applications" -ErrorAction SilentlyContinue
if ($apps) {
    foreach ($app in $apps) {
        $appName = (Get-ItemProperty $app.PSPath).Name
        $appPath = (Get-ItemProperty $app.PSPath).Path
        Write-Host "  - $appName ($appPath)" -ForegroundColor White
    }
} else {
    Write-Host "  (nenhum aplicativo registrado)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Uso:" -ForegroundColor White
Write-Host "  .\setup-remoteapp.ps1 -EnableRemoteApp"
Write-Host "  .\setup-remoteapp.ps1 -AppName 'Excel' -AppPath 'C:\...\EXCEL.EXE'"
Write-Host "============================================" -ForegroundColor Cyan
