# WebGate RDP

A modern, self-contained web-based RDP gateway that replaces TSPlus. Provides browser-based access to Windows Remote Desktop sessions with RemoteApp publishing, web printing, and bidirectional file transfer.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐  │
│  │  Login    │ │  Canvas  │ │  File  │ │   Print     │  │
│  │  Page     │ │  Viewer  │ │Manager │ │  Download   │  │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └──────┬──────┘  │
│       │ HTTPS       │ WSS      │ HTTPS        │ HTTPS   │
└───────┼─────────────┼──────────┼──────────────┼─────────┘
        │             │          │              │
┌───────┼─────────────┼──────────┼──────────────┼─────────┐
│       ▼             ▼          ▼              ▼         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              WebGate Server (Node.js)            │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │    │
│  │  │  Auth  │ │Native  │ │  File  │ │  Print   │ │    │
│  │  │ Module │ │RDP TCP │ │Transfer│ │ Handler  │ │    │
│  │  └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘ │    │
│  └──────┼──────────┼──────────┼────────────┼───────┘    │
│         │          │          │            │             │
│         ▼          ▼          ▼            ▼             │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ ┌──────────────┐   │
│  │ Windows │ │ Native   │ │ User  │ │ Virtual PDF  │   │
│  │  Auth   │ │ RDP :3389│ │ Dirs  │ │   Printer    │   │
│  │ (NTLM)  │ │(TCP sock)│ │       │ │ (GhostScript)│   │
│  └─────────┘ └──────────┘ └───────┘ └──────────────┘   │
│                Windows Server Host                       │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Web-based RDP Access**: Full desktop or RemoteApp via HTML5 Canvas/WebSocket
- **Unified Authentication**: Web login authenticates directly against Windows (NTLM/Kerberos)
- **RemoteApp Publishing**: Publish specific apps per user/group — users see only their apps
- **Web Printing**: Print from RDP session → PDF delivered to browser
- **Bidirectional File Transfer**: Upload/download files between browser and RDP session
- **Self-contained**: Built-in HTTPS web server, no external dependencies needed

## Tech Stack

- **Backend**: Node.js + TypeScript + Express + ws (WebSocket)
- **Frontend**: React + TypeScript + Vite
- **RDP Engine**: Native RDP protocol (MS-RDPBCGR) via TCP socket to localhost:3389
- **Print**: Virtual PostScript printer + GhostScript → PDF
- **Auth**: Windows NTLM authentication via PowerShell LogonUser API

## Quick Start

### Prerequisites

- Windows Server 2016+ with RDP enabled (localhost:3389)
- Node.js 18+ LTS
- GhostScript (optional, for print redirection)

### Installation

```bash
# Clone the repository
git clone https://github.com/secomanica/mikrotik.git
cd mikrotik

# Install dependencies
npm install

# Build
npm run build

# Configure
cp server/.env.example server/.env
# Edit server/.env with your settings

# Start
npm start
```

### Development

```bash
# Start backend in dev mode
npm run dev:server

# Start frontend in dev mode (separate terminal)
npm run dev:client
```

## Project Structure

```
├── server/                  # Backend Node.js server
│   ├── src/
│   │   ├── auth/           # Windows authentication (NTLM/Kerberos)
│   │   ├── rdp/            # RDP connection manager (FreeRDP wrapper)
│   │   ├── sessions/       # Session lifecycle management
│   │   ├── remoteapp/      # RemoteApp publishing & management
│   │   ├── print/          # Virtual printer → PDF pipeline
│   │   ├── filetransfer/   # Bidirectional file transfer
│   │   ├── routes/         # REST API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── config/         # Configuration management
│   │   └── utils/          # Shared utilities
│   └── scripts/            # Setup & installation scripts
├── client/                  # React frontend SPA
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API & WebSocket clients
│   │   ├── store/          # State management
│   │   └── types/          # TypeScript type definitions
│   └── public/             # Static assets
├── shared/                  # Shared types between client/server
│   └── types/              # Common TypeScript interfaces
└── docs/                    # Documentation
```

## API Overview

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate with Windows credentials |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/session` | Get current session info |
| GET | `/api/apps` | List published apps for current user |
| POST | `/api/apps` | (Admin) Publish a new app |
| PUT | `/api/apps/:id` | (Admin) Update app config |
| DELETE | `/api/apps/:id` | (Admin) Remove published app |
| POST | `/api/files/upload` | Upload file to RDP session |
| GET | `/api/files/download/:path` | Download file from RDP session |
| GET | `/api/files/list/:path` | List files in RDP session directory |
| GET | `/api/print/jobs` | List pending print jobs |
| GET | `/api/print/download/:id` | Download printed PDF |

### WebSocket Channels

| Channel | Description |
|---------|-------------|
| `ws://host/rdp` | RDP bitmap stream + input events |
| `ws://host/events` | Session events, print notifications, transfer progress |

## License

Proprietary - All rights reserved.
