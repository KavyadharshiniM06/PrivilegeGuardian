# PrivilegeGuardian — SIEM Platform

A production-grade Security Information and Event Management (SIEM) tool built with Node.js, MongoDB, and React.

## Architecture

```
PrivilegeGuardian/
├── backend/                   # Express + MongoDB API
│   ├── models/
│   │   ├── User.js            # Users (admin / auditor)
│   │   ├── AuditLog.js        # All ingested security events
│   │   ├── Alert.js           # Generated alerts
│   │   └── Report.js          # Compliance reports
│   ├── routes/
│   │   ├── auth.js            # POST /login, /register, GET /me
│   │   ├── users.js           # CRUD users (admin only)
│   │   ├── events.js          # GET events, POST ingest/replay
│   │   ├── alerts.js          # GET/PATCH/DELETE alerts
│   │   ├── stats.js           # Aggregated statistics + charts
│   │   └── reports.js         # Reports CRUD + CSV exports
│   ├── middleware/
│   │   └── auth.js            # JWT auth + adminOnly guard
│   ├── utils/
│   │   └── engine.js          # Risk engine + anomaly + alert logic
│   ├── server.js              # Express entry point
│   ├── seed.js                # Seeds default users + replays audit.log
│   └── .env                   # Environment variables
└── frontend/                  # React + Vite + Recharts
    └── src/
        ├── pages/
        │   ├── Login.jsx       # Auth (login + register)
        │   ├── Dashboard.jsx   # Live stats, charts, top users
        │   ├── Events.jsx      # Audit log table with filters + pagination
        │   ├── Alerts.jsx      # Security alerts with acknowledge flow
        │   ├── Users.jsx       # User management (admin)
        │   ├── Reports.jsx     # Compliance reports + CSV export
        │   └── Simulation.jsx  # Attack simulation + risk preview
        ├── components/
        │   ├── Layout.jsx      # Sidebar navigation
        │   └── UI.jsx          # StatCard, Table, Modal, Badge, RiskBar, etc.
        ├── hooks/
        │   └── useAuth.jsx     # Auth context (JWT storage)
        └── utils/
            └── api.js          # Typed API client with JWT injection
```

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # edit MONGO_URI + JWT_SECRET
npm run seed                  # creates admin/auditor users
npm run dev                   # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

### 3. Default Credentials

| Role    | Username  | Password     |
|---------|-----------|--------------|
| Admin   | admin     | admin123     |
| Auditor | auditor   | auditor123   |

## API Endpoints

### Auth
| Method | Path               | Description          |
|--------|--------------------|----------------------|
| POST   | /api/auth/login    | Login → JWT token    |
| POST   | /api/auth/register | Register new user    |
| GET    | /api/auth/me       | Current user info    |

### Events
| Method | Path                  | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | /api/events           | Paginated events with filters  |
| POST   | /api/events/ingest    | Ingest a single raw event      |
| POST   | /api/events/replay    | Replay audit.log into DB       |

### Alerts
| Method | Path                       | Description          |
|--------|----------------------------|----------------------|
| GET    | /api/alerts                | List alerts          |
| PATCH  | /api/alerts/:id/acknowledge | Acknowledge alert   |
| DELETE | /api/alerts/:id            | Delete alert         |

### Stats
| Method | Path                     | Description              |
|--------|--------------------------|--------------------------|
| GET    | /api/stats               | Aggregated metrics       |
| GET    | /api/stats/risk-over-time| Hourly risk time-series  |

### Reports
| Method | Path                          | Description            |
|--------|-------------------------------|------------------------|
| GET    | /api/reports                  | List reports           |
| POST   | /api/reports                  | Create report          |
| DELETE | /api/reports/:id              | Delete report          |
| GET    | /api/reports/export/events.csv | Export events CSV     |
| GET    | /api/reports/export/alerts.csv | Export alerts CSV     |

## Risk Engine

Events are scored using a weighted formula:

```
finalRisk = 0.7 × ruleRisk + 0.3 × anomalyScore × 100

ruleRisk = base_action + privileged_user + denied_access + sensitive_file
```

| Factor           | Score |
|------------------|-------|
| read/open        | +10   |
| write            | +40   |
| delete/unlink    | +70   |
| execute          | +50   |
| privileged user  | +20   |
| denied access    | +30   |
| sensitive file   | +30   |

Alert thresholds: LOW=50+, MEDIUM=60+, HIGH=75+, CRITICAL=85+

## Ingesting Events

Send JSON events to `/api/events/ingest`:

```json
{
  "username": "root",
  "action": "delete",
  "file": "/etc/shadow",
  "status": "denied",
  "time": "2026-04-18T10:30:00Z"
}
```

Or replay a log file (newline-delimited JSON):

```bash
curl -X POST http://localhost:4000/api/events/replay \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/audit.log"}'
```

## Tech Stack

- **Backend**: Node.js, Express, Mongoose, bcryptjs, jsonwebtoken
- **Database**: MongoDB Atlas
- **Frontend**: React 19, Vite, React Router v7, Recharts
- **Auth**: JWT (12h expiry), bcrypt (cost 12)
- **Fonts**: JetBrains Mono + Syne
