# MikroTik Manager

Sistema web de gestão centralizada para dispositivos MikroTik RouterOS 7.x+.

## Funcionalidades

### Gestão de Usuários e Permissões
- **Administrador**: Acesso total (CRUD dispositivos, usuários, todas operações RouterOS)
- **Leitura/Escrita**: Gerenciar dispositivos e configurações RouterOS (exceto operações destrutivas)
- **Somente Leitura**: Visualizar configurações e monitorar dispositivos
- Autenticação via JWT
- Log de auditoria de todas as operações

### Gestão de Dispositivos
- Adicionar/editar/remover dispositivos MikroTik
- Teste de conectividade
- Credenciais armazenadas com criptografia (Fernet)
- Status em tempo real

### Monitoramento
- Dashboard com visão geral de todos os dispositivos
- CPU, memória, armazenamento em tempo real
- Status de interfaces e tráfego
- Saúde do hardware (temperatura, voltagem)
- Logs do sistema

### RouterOS - Funcionalidades Completas via REST API

O sistema utiliza um proxy transparente que mapeia **todas** as funcionalidades do RouterOS:

| Categoria | Recursos |
|-----------|----------|
| **Sistema** | Identidade, Recursos, Pacotes, Usuários, Clock, NTP, Reboot |
| **IP** | Endereços, Rotas, DNS, DHCP Server/Client, Pool, ARP |
| **Firewall** | Filter, NAT, Mangle, Raw, Address Lists, Conexões |
| **Interfaces** | Ethernet, VLAN, Bridge, Bonding, WireGuard |
| **Roteamento** | OSPF, BGP, Rotas Estáticas |
| **Filas** | Simple Queues, Queue Tree |
| **VPN** | IPSec, WireGuard, L2TP, SSTP, OpenVPN |
| **Ferramentas** | Ping, Traceroute, Bandwidth Test, Torch, Netwatch |
| **Arquivos** | Listagem, Backup, Export |
| **Logs** | Visualização em tempo real |

### Proxy Transparente RouterOS

Qualquer endpoint RouterOS REST API é acessível via:
```
GET/PUT/PATCH/DELETE /api/devices/{id}/ros/{routeros-path}
```

Exemplos:
- `GET /api/devices/1/ros/ip/address` → Lista endereços IP
- `PUT /api/devices/1/ros/ip/firewall/filter` → Cria regra de firewall
- `PATCH /api/devices/1/ros/ip/firewall/filter/*1` → Edita regra
- `DELETE /api/devices/1/ros/ip/firewall/filter/*1` → Remove regra

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Frontend       │────▶│  Backend         │────▶│  MikroTik       │
│  React + MUI    │     │  FastAPI         │     │  RouterOS 7.x   │
│  TypeScript     │     │  SQLAlchemy      │     │  REST API       │
│                 │     │  JWT Auth        │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       :3000                  :8000               :443 (HTTPS)
```

## Início Rápido

### Com Docker

```bash
# Clone o repositório
git clone <repo-url>
cd mikrotik

# Configure as variáveis de ambiente
cp backend/.env.example backend/.env
# Edite backend/.env com suas chaves secretas

# Inicie com Docker
docker-compose up -d
```

Acesse: http://localhost

### Desenvolvimento Local

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:3000

### Credenciais Padrão

- **Usuário**: admin
- **Senha**: admin

> ⚠️ Altere a senha padrão após o primeiro login.

## Configuração

### Variáveis de Ambiente (backend/.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `SECRET_KEY` | Chave para assinatura JWT | Deve ser alterada |
| `DEVICE_CREDENTIAL_KEY` | Chave de criptografia (32 bytes) | Deve ser alterada |
| `DATABASE_URL` | URL do banco de dados | SQLite local |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiração do token | 480 (8h) |
| `CORS_ORIGINS` | Origens permitidas | localhost |
| `MIKROTIK_REQUEST_TIMEOUT` | Timeout de requisições (seg) | 30 |

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Perfil atual
- `PATCH /api/auth/me/password` - Alterar senha

### Usuários (Admin)
- `GET/POST /api/users` - Listar/Criar
- `GET/PATCH/DELETE /api/users/{id}` - Consultar/Editar/Desativar

### Dispositivos
- `GET/POST /api/devices` - Listar/Criar
- `GET/PATCH/DELETE /api/devices/{id}` - Consultar/Editar/Remover
- `POST /api/devices/{id}/test` - Testar conexão
- `GET /api/devices/{id}/status` - Status em tempo real

### Monitoramento
- `GET /api/devices/{id}/monitor/resources` - Recursos do sistema
- `GET /api/devices/{id}/monitor/health` - Saúde do hardware
- `GET /api/devices/{id}/monitor/interfaces` - Interfaces
- `GET /api/devices/{id}/monitor/overview` - Visão geral
- `GET /api/devices/{id}/monitor/logs` - Logs

### Ferramentas
- `POST /api/devices/{id}/tools/ping` - Ping
- `POST /api/devices/{id}/tools/traceroute` - Traceroute
- `POST /api/devices/{id}/tools/bandwidth-test` - Teste de banda
- `POST /api/devices/{id}/tools/torch` - Torch

### RouterOS Proxy
- `GET/PUT/PATCH/DELETE /api/devices/{id}/ros/{path}` - Proxy transparente

### Auditoria (Admin)
- `GET /api/audit` - Logs de auditoria

## Requisitos do RouterOS

- **Versão**: 7.20 ou superior
- **Serviço www-ssl** (ou www) habilitado
- **Usuário com permissão API** configurado no dispositivo
- Porta 443 (HTTPS) acessível a partir do servidor

### Configurar no RouterOS

```routeros
/ip/service/set www-ssl disabled=no
/user/add name=api-user group=full password=senha-segura
```

## Tecnologias

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, httpx, JWT
- **Frontend**: React 18, TypeScript, Material UI 6, React Query, Recharts
- **Banco**: SQLite (produção: PostgreSQL)
- **Infra**: Docker, Nginx
