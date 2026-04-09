# WebGate RDP - Guia de Deployment

## Requisitos do Servidor

- **Sistema Operacional**: Windows Server 2016+ (com Remote Desktop Services habilitado)
- **Node.js**: 18+ LTS
- **FreeRDP**: wfreerdp.exe no PATH (v2.0+ ou v3.0+)
- **GhostScript**: gswin64c.exe no PATH (para impressão virtual)
- **Portas**: 8443 (web), 3389 (RDP local)

## Instalação Passo a Passo

### 1. Preparar o Windows Server

```powershell
# Habilitar Remote Desktop
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0

# Abrir porta do firewall para WebGate
New-NetFirewallRule -DisplayName "WebGate RDP" -Direction Inbound -Port 8443 -Protocol TCP -Action Allow

# Configurar RemoteApp (se necessário)
powershell -ExecutionPolicy Bypass -File .\server\scripts\setup-remoteapp.ps1 -EnableRemoteApp
```

### 2. Instalar Dependências

```powershell
# Instalar Node.js 18+ LTS
# Download: https://nodejs.org/

# Instalar FreeRDP
# Download: https://github.com/FreeRDP/FreeRDP/releases
# Extrair wfreerdp.exe para C:\Program Files\FreeRDP\ e adicionar ao PATH

# Instalar GhostScript
# Download: https://www.ghostscript.com/releases/gsdnld.html
```

### 3. Instalar WebGate RDP

```powershell
# Clonar o repositório
git clone https://github.com/secomanica/mikrotik.git "C:\Program Files\WebGate RDP"
cd "C:\Program Files\WebGate RDP"

# Instalar dependências
npm install

# Compilar
npm run build

# Configurar
copy server\.env.example server\.env
# Editar server\.env com suas configurações
notepad server\.env
```

### 4. Configurar TLS (Recomendado)

```powershell
# Gerar certificado autoassinado (desenvolvimento)
mkdir server\certs
openssl req -x509 -newkey rsa:4096 -keyout server\certs\server.key -out server\certs\server.crt -days 365 -nodes -subj "/CN=webgate.local"

# Ou use certificado Let's Encrypt para produção
```

### 5. Instalar Impressora Virtual (Opcional)

```powershell
powershell -ExecutionPolicy Bypass -File .\server\scripts\install-printer.ps1
```

### 6. Instalar como Serviço Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\server\scripts\install-service.ps1 -Action install
powershell -ExecutionPolicy Bypass -File .\server\scripts\install-service.ps1 -Action start
```

### 7. Verificar Instalação

Abra o navegador em: `https://seu-servidor:8443`

## Configuração (.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `HOST` | IP de escuta | `0.0.0.0` |
| `PORT` | Porta do servidor web | `8443` |
| `TLS_CERT` | Caminho do certificado TLS | - |
| `TLS_KEY` | Caminho da chave TLS | - |
| `RDP_HOST` | Host do serviço RDP | `127.0.0.1` |
| `RDP_PORT` | Porta RDP | `3389` |
| `SESSION_SECRET` | Segredo para JWT | (alterar!) |
| `SESSION_TIMEOUT` | Timeout da sessão (ms) | `3600000` |
| `MAX_SESSIONS` | Máximo de sessões simultâneas | `50` |
| `FREERDP_PATH` | Caminho do wfreerdp | `wfreerdp` |
| `GHOSTSCRIPT_PATH` | Caminho do GhostScript | `gswin64c` |
| `LOG_LEVEL` | Nível de log | `info` |

## Publicar Aplicativos (RemoteApp)

### Via Painel Admin (Web)

1. Faça login com um usuário administrador
2. Clique em "Painel Admin" no canto inferior
3. Clique em "Publicar Aplicativo"
4. Preencha o caminho do executável e os usuários/grupos permitidos

### Via PowerShell

```powershell
.\server\scripts\setup-remoteapp.ps1 `
  -AppName "Excel" `
  -AppPath "C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE"
```

## Arquitetura de Rede

```
Internet/LAN
    |
    ├── :8443 (HTTPS/WSS) ── WebGate Server
    |                            |
    |                            ├── :3389 (RDP) ── localhost
    |                            |
    |                            ├── Print Spool (filesystem)
    |                            |
    |                            └── File Transfer (filesystem)
```

## Monitoramento

- **Health check**: `GET /api/health`
- **Logs**: `webgate.log` e `webgate-error.log`
- **Sessões ativas**: Painel admin ou `GET /api/rdp/status`

## Troubleshooting

### Erro de autenticação
- Verifique se o usuário tem permissão de Remote Desktop
- Execute: `net localgroup "Remote Desktop Users" USUARIO /add`

### FreeRDP não conecta
- Verifique se o serviço RDP está rodando: `sc query TermService`
- Teste manualmente: `wfreerdp /v:127.0.0.1 /u:USUARIO /p:SENHA`

### Impressão não funciona
- Verifique se GhostScript está no PATH: `gswin64c --version`
- Verifique permissões no diretório de spool
