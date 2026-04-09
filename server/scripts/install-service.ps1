# ============================================================
# WebGate RDP - Windows Service Installation
# ============================================================
# Run as Administrator
# Installs WebGate RDP as a Windows Service using NSSM
# ============================================================

param(
    [string]$ServiceName = "WebGateRDP",
    [string]$InstallDir = "$env:ProgramFiles\WebGate RDP",
    [string]$NssmPath = ".\nssm.exe",
    [ValidateSet("install", "uninstall", "start", "stop", "status")]
    [string]$Action = "install"
)

$ErrorActionPreference = 'Stop'

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  WebGate RDP - Gerenciamento de Servico" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERRO: Execute este script como Administrador!" -ForegroundColor Red
    exit 1
}

$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Host "ERRO: Node.js nao encontrado. Instale Node.js 18+ LTS." -ForegroundColor Red
    exit 1
}

switch ($Action) {
    "install" {
        Write-Host "Instalando servico '$ServiceName'..." -ForegroundColor Yellow

        # Check if NSSM exists, if not guide the user
        if (-not (Test-Path $NssmPath)) {
            Write-Host "[INFO] NSSM nao encontrado. Tentando instalar via sc.exe..." -ForegroundColor Yellow

            # Create a wrapper batch file
            $wrapperPath = Join-Path $InstallDir "webgate-service.bat"
            $serverEntry = Join-Path $InstallDir "server\dist\index.js"

            @"
@echo off
cd /d "$InstallDir"
"$nodePath" "$serverEntry"
"@ | Set-Content $wrapperPath

            # Install using sc.exe
            sc.exe create $ServiceName `
                binPath= """$wrapperPath""" `
                DisplayName= "WebGate RDP Server" `
                start= auto `
                obj= "LocalSystem"

            sc.exe description $ServiceName "WebGate RDP - Servidor de acesso remoto via navegador"
            sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000
        } else {
            # Install using NSSM (preferred)
            $serverEntry = Join-Path $InstallDir "server\dist\index.js"

            & $NssmPath install $ServiceName $nodePath $serverEntry
            & $NssmPath set $ServiceName DisplayName "WebGate RDP Server"
            & $NssmPath set $ServiceName Description "WebGate RDP - Servidor de acesso remoto via navegador"
            & $NssmPath set $ServiceName AppDirectory $InstallDir
            & $NssmPath set $ServiceName AppStdout (Join-Path $InstallDir "logs\service-stdout.log")
            & $NssmPath set $ServiceName AppStderr (Join-Path $InstallDir "logs\service-stderr.log")
            & $NssmPath set $ServiceName AppRotateFiles 1
            & $NssmPath set $ServiceName AppRotateBytes 10485760
            & $NssmPath set $ServiceName Start SERVICE_AUTO_START
            & $NssmPath set $ServiceName ObjectName LocalSystem
        }

        Write-Host "[OK] Servico '$ServiceName' instalado com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para iniciar: .\install-service.ps1 -Action start"
    }

    "uninstall" {
        Write-Host "Removendo servico '$ServiceName'..." -ForegroundColor Yellow
        sc.exe stop $ServiceName 2>$null
        Start-Sleep -Seconds 2
        sc.exe delete $ServiceName
        Write-Host "[OK] Servico removido." -ForegroundColor Green
    }

    "start" {
        sc.exe start $ServiceName
        Write-Host "[OK] Servico iniciado." -ForegroundColor Green
    }

    "stop" {
        sc.exe stop $ServiceName
        Write-Host "[OK] Servico parado." -ForegroundColor Green
    }

    "status" {
        sc.exe query $ServiceName
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
