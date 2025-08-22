# Cursor Mobile Chat

> **🎯 Build Status:** M0 Scaffolding Complete ✅  
> A mobile app to view your complete Cursor chats and trigger safe actions (Agents via Web, Slack, GitHub).

## 🏗️ Project Overview

This monorepo contains a complete mobile chat viewer for Cursor with real-time sync and safe action triggers:

- **📱 Mobile App (React Native/Expo)** - View threads, messages, trigger actions
- **🖥️ Desktop Companion (Node CLI)** - Watches Cursor's local SQLite and syncs to server
- **⚡ Backend Server (Fastify)** - REST API + WebSocket for real-time updates
- **📦 Shared Packages** - Types, utilities, and data extraction logic

## 🚀 Quick Start

### Prerequisites

- Node.js ≥18.0.0
- pnpm ≥8.0.0 (or npm with workspaces)
- iOS/Android development environment for mobile app
- Expo Go app on your phone (for mobile testing)

### **🎯 3-Step Setup**

```bash
# 1. Clone and install
git clone https://github.com/hassantayyab/cursor-mobile-chat.git
cd cursor-mobile-chat
pnpm install

# 2. Start all services (one command!)
pnpm dev
```

### **📱 Access Your App**

After running `pnpm dev`, you'll have:

- **🌐 API Server**: http://localhost:3001
- **📚 API Docs**: http://localhost:3001/docs
- **📱 Mobile App**: http://localhost:8081 (scan QR code with Expo Go app)
- **🖥️ Desktop Companion**: Ready to extract your Cursor chats

### **⚡ Individual Commands (Alternative)**

```bash
# Option 1: Run everything at once
pnpm dev

# Option 2: Run services individually (3 separate terminals)
pnpm --filter server dev      # Terminal 1: Backend API
pnpm --filter mobile dev      # Terminal 2: Mobile app
pnpm --filter desktop-companion dev extract --dry  # Terminal 3: Extract chats
```

### **🧪 Testing Your Setup**

```bash
# Test API server
curl http://localhost:3001/healthz

# Extract your actual Cursor chats
pnpm --filter desktop-companion dev extract --dry

# Mobile app controls (when Expo is running):
# Press 'w' = Open in web browser
# Press 'i' = Open iOS simulator
# Press 'a' = Open Android emulator
# Press 'r' = Reload app
# Scan QR code = Open on phone with Expo Go
```

## 📁 Project Structure

```
cursor-mobile-chat/
├── apps/
│   ├── mobile/                 # React Native mobile app
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── screens/        # Navigation screens
│   │   │   ├── hooks/          # React Query & custom hooks
│   │   │   ├── services/       # API & WebSocket services
│   │   │   ├── stores/         # Zustand state management
│   │   │   └── navigation/     # React Navigation setup
│   │   ├── App.tsx
│   │   └── global.css          # Tailwind v4 styles
│   │
│   ├── server/                 # Fastify backend server
│   │   ├── src/
│   │   │   ├── routes/         # API routes
│   │   │   ├── services/       # Business logic
│   │   │   └── utils/          # Server utilities
│   │   └── src/server.ts       # Fastify app setup
│   │
│   └── desktop-companion/      # Node CLI tool
│       ├── src/
│       └── cli.ts              # CLI commands
│
├── packages/
│   ├── shared/                 # Shared types & utilities
│   │   ├── src/
│   │   ├── types.ts            # Zod schemas & TypeScript types
│   │   └── utils.ts            # Common utilities
│   │
│   └── extractor/              # SQLite data extraction
│       ├── src/
│       ├── adapters/           # Data format adapters
│       ├── utils/              # Safe DB reading
│       └── normalizer.ts       # Main extraction logic
│
├── package.json                # Root package.json with workspaces
├── turbo.json                  # Turborepo configuration
├── tsconfig.json               # Base TypeScript config
├── .eslintrc.json             # ESLint configuration
└── .prettierrc                # Prettier configuration
```

## 🏃‍♂️ Development Guide

### Mobile App Features

- **🔐 Settings Screen** - Configure server URL and auth token
- **📋 Threads List** - View all conversations with search and pagination
- **💬 Messages View** - Read messages with code block syntax highlighting
- **🔄 Real-time Updates** - WebSocket integration for live message sync
- **⚡ State Management** - Zustand for app state, React Query for server state
- **🎨 Modern UI** - Tailwind v4 with NativeWind, responsive design

### Backend Server Features

- **🛡️ Authentication** - Bearer token authentication
- **📊 REST API** - Threads and messages endpoints with pagination
- **🔌 WebSocket** - Real-time message broadcasting
- **📚 API Docs** - Swagger/OpenAPI documentation at `/docs`
- **🚦 Rate Limiting** - Built-in request throttling
- **🌐 CORS Support** - Configurable origin whitelisting

### Desktop Companion Features

- **🔍 Data Extraction** - Safely reads Cursor's SQLite databases
- **🔄 Dual Adapters** - Supports both `chatdata` and `composer` formats
- **📡 Auto-sync** - Watch mode for continuous database monitoring
- **🛡️ Safe Reading** - Copies DBs to temp location before access
- **⚙️ CLI Interface** - Easy-to-use command line tool

### Data Extraction Architecture

The extractor package includes sophisticated logic to handle Cursor's data formats:

- **Path Discovery** - Auto-finds Cursor databases on macOS/Windows/Linux
- **Safe DB Reading** - Handles WAL files and concurrent access safely
- **Schema Tolerance** - Adapts to Cursor's evolving database schemas
- **Dual Adapters** - Supports both legacy and modern chat formats
- **Data Normalization** - Converts to consistent Thread/Message format

## 🔧 Configuration

### Server Configuration

Set these environment variables:

```bash
PORT=3001
AUTH_TOKEN=your-secure-token-here
CORS_ORIGINS=*
LOG_LEVEL=info
```

### Mobile App Configuration

Configure in the Settings screen:

- **Server URL** - Your server endpoint (e.g., `http://localhost:3001`)
- **Auth Token** - Matching token from server config

### Desktop Companion Configuration

```bash
SERVER_URL=http://localhost:3001
AUTH_TOKEN=your-secure-token-here
```

## 🏛️ Architecture Decisions

### Why This Tech Stack?

- **React Native/Expo** - Cross-platform mobile with excellent DX
- **Fastify** - High-performance Node.js server framework
- **Zod** - Runtime type safety across the entire stack
- **React Query** - Powerful server state management
- **Zustand** - Lightweight client state management
- **Tailwind v4** - Modern CSS framework with better performance
- **TypeScript** - Type safety and excellent developer experience

### Key Design Principles

- **Privacy First** - Read-only by default, data stays local unless explicitly synced
- **Schema Tolerant** - Handles Cursor database changes gracefully
- **Graceful Degradation** - Works offline, shows useful errors
- **Modern UX** - Real-time updates, smooth animations, responsive design

## 📚 API Documentation

When the server is running, visit `/docs` for interactive Swagger documentation.

### Key Endpoints

- `GET /healthz` - Health check
- `GET /threads` - List threads with search & pagination
- `GET /threads/:id` - Get messages for a thread
- `POST /actions/slack` - Trigger Slack mention
- `POST /actions/github-comment` - Comment on GitHub PR/issue
- `POST /actions/agents` - Generate Agents deep-link
- `WS /live` - WebSocket for real-time updates

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix

# Formatting
pnpm format
pnpm format:check
```

## 🛣️ Roadmap

### ✅ M0 - Scaffolding (Complete)

- Monorepo setup with all packages and apps
- Mobile app with navigation and basic UI
- Server with REST API and WebSocket support
- Desktop companion with data extraction
- Shared types and comprehensive utilities

### 🏗️ M1 - Extract & Mirror (Next)

- Complete desktop companion sync logic
- Server data storage implementation
- End-to-end data flow testing

### 📱 M2 - Mobile Viewer (Upcoming)

- Polish mobile UI/UX
- Add action sheets for safe actions
- Implement offline caching
- Search and filtering

### 🚀 M3 - Production Ready (Future)

- Authentication improvements
- Error handling and logging
- Performance optimizations
- App store deployment

## 🤝 Contributing

1. Clone the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `pnpm lint && pnpm type-check`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Status:** M0 Scaffolding Complete ✅  
**Next:** M1 Extract & Mirror Implementation 🏗️
