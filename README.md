# Maji

**Water Supply Platform for Freetown, Sierra Leone**

Maji is a mobile-first platform that brings visibility and efficiency to Freetown's informal water and energy economy. The app provides real-time water supply alerts, a vendor marketplace with mobile money payments, and community-driven infrastructure reporting.

## Features

### Core Features
- **Supply Intelligence**: Real-time water supply alerts crowdsourced from community "Water Scouts"
- **Vendor Marketplace**: Directory of water vendors with ratings, prices, and mobile money payments
- **Resource Map**: Live map of water points, vendors, solar charging stations, and battery rentals
- **Leak Reporting**: Citizen reporting system with bounty rewards
- **Offline Support**: Core features work offline with sync when connected

### User Roles
- **Citizen**: View alerts, browse vendors, place orders, submit reports
- **Water Scout**: Post supply alerts, earn reputation and payments
- **Vendor**: Manage products, accept orders, process payments
- **Admin**: User management, vendor verification, report moderation

## Tech Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify
- **Database**: PostgreSQL 15 with PostGIS
- **ORM**: Prisma
- **Cache/Queue**: Redis
- **Auth**: JWT with OTP verification

### Mobile
- **Framework**: React Native
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation
- **Maps**: react-native-maps

### External Integrations
- **Mobile Money**: Orange Money, Africell Money
- **SMS**: Africa's Talking
- **Push Notifications**: Firebase Cloud Messaging
- **Maps**: Mapbox / OpenStreetMap

## Project Structure

```
Maji/
├── backend/                 # Fastify API server
│   ├── prisma/             # Database schema and migrations
│   │   ├── schema.prisma   # Prisma schema
│   │   └── seed.ts         # Database seed data
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── middleware/     # Auth, validation middleware
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Server entry point
│   ├── Dockerfile
│   └── package.json
├── mobile/                  # React Native app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── screens/        # Screen components
│   │   ├── navigation/     # Navigation setup
│   │   ├── store/          # Redux store
│   │   ├── services/       # API client
│   │   ├── hooks/          # Custom hooks
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utilities
│   └── package.json
├── docker-compose.yml       # Docker setup
└── Maji_Technical_Specification.md
```

## Getting Started

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15 (or use Docker)
- Redis (or use Docker)

### Quick Start with Docker

```bash
# Clone the repository
git clone <repository-url>
cd Maji

# Start all services
docker-compose up -d

# The API will be available at http://localhost:3000
# API documentation at http://localhost:3000/docs
```

### Manual Setup

#### Backend

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database and API credentials

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start development server
npm run dev
```

#### Mobile App

```bash
cd mobile

# Install dependencies
npm install

# iOS (macOS only)
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

## API Documentation

The API follows REST conventions with JSON responses. Full documentation is available at `/docs` when running the server.

### Authentication

All authenticated endpoints require a Bearer token:
```
Authorization: Bearer <access_token>
```

#### Request OTP
```bash
POST /v1/auth/otp/request
{
  "phone": "+23276123456"
}
```

#### Verify OTP
```bash
POST /v1/auth/otp/verify
{
  "phone": "+23276123456",
  "otp": "123456"
}
```

### Main Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/zones` | List zones |
| `GET /v1/alerts` | Get water alerts |
| `POST /v1/alerts` | Create alert (Scout only) |
| `GET /v1/vendors` | List vendors |
| `GET /v1/vendors/:id` | Vendor details |
| `POST /v1/orders` | Create order |
| `GET /v1/orders` | List user's orders |
| `POST /v1/reports` | Submit infrastructure report |
| `GET /v1/resources` | Get map resources |

## Development

### Test Users (after seeding)

| Role | Phone | Description |
|------|-------|-------------|
| Admin | +23276000000 | Full admin access |
| Scout | +23276111111 | Can post alerts |
| Vendor | +23276222222 | Has vendor profile |

In development mode, any 6-digit OTP code works for testing.

### Running Tests

```bash
# Backend
cd backend
npm test

# Mobile
cd mobile
npm test
```

### Code Style

- TypeScript with strict mode
- ESLint for linting
- Prettier for formatting

## Environment Variables

### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/maji

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# External Services
AT_API_KEY=          # Africa's Talking
ORANGE_CLIENT_ID=    # Orange Money
AFRICELL_API_KEY=    # Africell Money
MAPBOX_ACCESS_TOKEN= # Mapbox
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.
