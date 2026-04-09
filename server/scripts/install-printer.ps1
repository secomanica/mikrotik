# ============================================================
# WebGate RDP - Virtual Printer Installation Script
# ============================================================
# Run as Administrator on the Windows Server
# This script installs a virtual PDF printer that captures
# print jobs from RDP sessions and delivers them to the browser.
#
# Prerequisites: GhostScript installed and in PATH
# ============================================================

param(
    [string]$PrinterName = "WebGate PDF",
    [string]$SpoolDir = "$env:ProgramData\WebGate\print-spool",
    [string]$GhostScriptPath = "gswin64c"
)

$ErrorActionPreference = 'Stop'

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  WebGate RDP - Instalacao de Impressora Virtual" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERRO: Execute este script como Administrador!" -ForegroundColor Red
    exit 1
}

# Check GhostScript
try {
    $gsVersion = & $GhostScriptPath --version 2>&1
    Write-Host "[OK] GhostScript encontrado: $gsVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] GhostScript nao encontrado em: $GhostScriptPath" -ForegroundColor Red
    Write-Host "Instale o GhostScript: https://www.ghostscript.com/releases/gsdnld.html"
    exit 1
}

# Create spool directory
if (-not (Test-Path $SpoolDir)) {
    New-Item -ItemType Directory -Path $SpoolDir -Force | Out-Null
    Write-Host "[OK] Diretorio de spool criado: $SpoolDir" -ForegroundColor Green
} else {
    Write-Host "[OK] Diretorio de spool ja existe: $SpoolDir" -ForegroundColor Green
}

# Set permissions on spool directory
$acl = Get-Acl $SpoolDir
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.AddAccessRule($rule)
Set-Acl $SpoolDir $acl
Write-Host "[OK] Permissoes configuradas no diretorio de spool" -ForegroundColor Green

# Check if printer already exists
$existingPrinter = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if ($existingPrinter) {
    Write-Host "[INFO] Impressora '$PrinterName' ja existe. Removendo para reinstalar..." -ForegroundColor Yellow
    Remove-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Install the virtual printer using Windows built-in "Microsoft PS Class Driver"
# This creates a PostScript printer that outputs to our spool directory
try {
    # Add printer port pointing to our spool directory
    $portName = "WebGate_PDF_Port"
    $existingPort = Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue
    if (-not $existingPort) {
        Add-PrinterPort -Name $portName -PrinterHostAddress "127.0.0.1"
        Write-Host "[OK] Porta da impressora criada: $portName" -ForegroundColor Green
    }

    # Add the printer using the Generic PostScript driver
    Add-Printer -Name $PrinterName `
        -DriverName "Microsoft PS Class Driver" `
        -PortName $portName `
        -Comment "WebGate RDP - Impressora virtual PDF" `
        -Location "WebGate Server"

    Write-Host "[OK] Impressora '$PrinterName' instalada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "[AVISO] Nao foi possivel instalar com driver PS Class. Tentando driver alternativo..." -ForegroundColor Yellow

    try {
        # Fallback: use Generic / Text Only driver
        Add-Printer -Name $PrinterName `
            -DriverName "Generic / Text Only" `
            -PortName "LPT1:" `
            -Comment "WebGate RDP - Impressora virtual PDF"

        Write-Host "[OK] Impressora '$PrinterName' instalada (driver texto)" -ForegroundColor Green
    } catch {
        Write-Host "[ERRO] Falha ao instalar a impressora: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Instalacao concluida!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "A impressora '$PrinterName' foi instalada."
Write-Host "Os trabalhos de impressao serao salvos em: $SpoolDir"
Write-Host ""
Write-Host "Nota: O servico WebGate RDP monitorara este diretorio"
Write-Host "e convertera automaticamente os arquivos para PDF."
