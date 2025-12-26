# Maji - Technical Specification & Architecture Document

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Ready for Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Core Features & User Flows](#4-core-features--user-flows)
5. [Database Schema](#5-database-schema)
6. [API Specification](#6-api-specification)
7. [External Integrations](#7-external-integrations)
8. [Offline-First Architecture](#8-offline-first-architecture)
9. [Security & Authentication](#9-security--authentication)
10. [USSD Integration](#10-ussd-integration)
11. [Maps & Geolocation](#11-maps--geolocation)
12. [Notifications System](#12-notifications-system)
13. [Analytics & Data Pipeline](#13-analytics--data-pipeline)
14. [DevOps & Deployment](#14-devops--deployment)
15. [MVP Scope & Phasing](#15-mvp-scope--phasing)

---

## 1. Executive Summary

### 1.1 Product Overview

Maji is a mobile platform that brings visibility and efficiency to Freetown's informal water and energy economy. The app provides:

- **Supply Intelligence**: Real-time water supply alerts crowdsourced from community "Water Scouts"
- **Vendor Marketplace**: Directory of water vendors with ratings, prices, and mobile money payments
- **Resource Map**: Live map of water points, vendors, solar charging stations, and battery rentals
- **Shortage Response**: Bulk ordering aggregation for tanker trucks during water shortages
- **Leak Reporting**: Citizen reporting system with bounty rewards

### 1.2 Technical Requirements

| Requirement | Specification |
|-------------|---------------|
| Primary Platform | Android (70%+ market share in Sierra Leone) |
| Secondary Platform | iOS, Progressive Web App |
| Offline Support | Core features must work offline |
| Low Bandwidth | Optimized for 2G/3G connections |
| USSD Fallback | Feature phones via *232# menu |
| Languages | English, Krio |
| Payment Integration | Orange Money, Africell Money |

### 1.3 Key Constraints

- **Connectivity**: Intermittent internet, frequent disconnections
- **Device Diversity**: Mix of low-end Android phones and feature phones
- **Battery Conservation**: Users often have limited charging access
- **Data Costs**: Users are price-sensitive about data usage

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Android App    │    iOS App      │      PWA        │     USSD Gateway      │
│  (React Native) │  (React Native) │   (Next.js)     │   (Africa's Talking)  │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                     │
         └─────────────────┴────────┬────────┴─────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                         (Kong / AWS API Gateway)                             │
│              Rate Limiting | Auth | Load Balancing | Caching                │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   User Service  │  Water Service  │ Payment Service │  Notification Service │
│                 │                 │                 │                       │
│ - Auth          │ - Supply Alerts │ - Transactions  │ - Push (FCM/APNS)     │
│ - Profiles      │ - Vendors       │ - Escrow        │ - SMS (Twilio/AT)     │
│ - Reputation    │ - Resources     │ - Settlements   │ - USSD                │
│ - KYC           │ - Reports       │ - Refunds       │ - In-App              │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                     │
         └─────────────────┴────────┬────────┴─────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   PostgreSQL    │     Redis       │  Elasticsearch  │    S3 / Cloudinary    │
│   (Primary DB)  │   (Cache/Queue) │    (Search)     │    (Media Storage)    │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Orange Money   │  Africell Money │  Africa's       │   Google Maps /       │
│  API            │  API            │  Talking        │   OpenStreetMap       │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
```

### 2.2 Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MICROSERVICES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ User Service │  │Water Service │  │  Map Service │          │
│  │              │  │              │  │              │          │
│  │ /users       │  │ /alerts      │  │ /resources   │          │
│  │ /auth        │  │ /vendors     │  │ /locations   │          │
│  │ /scouts      │  │ /orders      │  │ /zones       │          │
│  │ /reputation  │  │ /reports     │  │ /search      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │Payment Svc   │  │Notification  │  │Analytics Svc │          │
│  │              │  │Service       │  │              │          │
│  │ /transactions│  │ /push        │  │ /events      │          │
│  │ /wallets     │  │ /sms         │  │ /reports     │          │
│  │ /payouts     │  │ /ussd        │  │ /exports     │          │
│  │ /escrow      │  │ /templates   │  │ /dashboard   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend (Mobile)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React Native | Cross-platform, large ecosystem, good offline support |
| State Management | Redux Toolkit + RTK Query | Caching, offline sync, predictable state |
| Offline Storage | WatermelonDB | Optimized for React Native, sync-capable |
| Maps | react-native-maps + Mapbox | Offline map tiles support |
| Navigation | React Navigation v6 | Native performance |
| Forms | React Hook Form + Zod | Lightweight, validation |
| Styling | NativeWind (Tailwind) | Consistent styling, small bundle |

### 3.2 Frontend (Web/PWA)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14 | SSR, API routes, PWA support |
| State | Zustand + TanStack Query | Lightweight, caching |
| Offline | Workbox | Service worker management |
| Maps | Leaflet + OpenStreetMap | Free, offline tiles |
| UI | Tailwind CSS + Radix UI | Accessible, customizable |

### 3.3 Backend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js 20 LTS | JavaScript ecosystem, async I/O |
| Framework | Fastify | Faster than Express, schema validation |
| API Style | REST + JSON:API | Simple, cacheable, well-understood |
| Validation | Zod | Type-safe, runtime validation |
| ORM | Prisma | Type-safe, migrations, good DX |
| Queue | BullMQ (Redis) | Job processing, retries |
| Real-time | Socket.io | WebSocket with fallbacks |

### 3.4 Database

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Primary DB | PostgreSQL 15 | PostGIS for geo, JSONB for flexibility |
| Cache | Redis 7 | Sessions, caching, rate limiting, queues |
| Search | Elasticsearch 8 | Full-text search, geo queries |
| Time-series | TimescaleDB (PG extension) | Analytics, supply patterns |

### 3.5 Infrastructure

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Cloud | AWS / DigitalOcean | Regional availability, cost |
| Container | Docker + Docker Compose | Local dev parity |
| Orchestration | Kubernetes (EKS) or AWS ECS | Scaling, management |
| CDN | CloudFlare | Edge caching, DDoS protection |
| Media | Cloudinary | Image optimization, CDN |
| Monitoring | Grafana + Prometheus | Observability |
| Logging | Loki or CloudWatch | Log aggregation |
| APM | Sentry | Error tracking |

---

## 4. Core Features & User Flows

### 4.1 User Roles

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ROLES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CITIZEN (Default)                                              │
│  ├── View supply alerts                                         │
│  ├── Browse vendors & resources                                 │
│  ├── Place orders                                               │
│  ├── Submit reports (leaks, blockages)                          │
│  ├── Rate vendors                                               │
│  └── Join bulk orders                                           │
│                                                                  │
│  WATER SCOUT (Verified)                                         │
│  ├── All Citizen permissions                                    │
│  ├── Post supply alerts                                         │
│  ├── Earn reputation points                                     │
│  ├── Receive scout payments                                     │
│  └── Access scout dashboard                                     │
│                                                                  │
│  VENDOR (Verified)                                              │
│  ├── Manage vendor profile                                      │
│  ├── Set prices & availability                                  │
│  ├── Accept/reject orders                                       │
│  ├── Process payments                                           │
│  ├── View analytics                                             │
│  └── Manage delivery zones                                      │
│                                                                  │
│  BUSINESS (Premium)                                             │
│  ├── All Citizen permissions                                    │
│  ├── Priority alerts                                            │
│  ├── Guaranteed delivery slots                                  │
│  ├── Bulk ordering tools                                        │
│  └── API access                                                 │
│                                                                  │
│  ADMIN (Internal)                                               │
│  ├── User management                                            │
│  ├── Vendor verification                                        │
│  ├── Report moderation                                          │
│  ├── Payment management                                         │
│  └── Analytics dashboard                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Core User Flows

#### 4.2.1 User Registration & Onboarding

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Welcome   │────▶│ Phone Entry │────▶│  OTP Verify │────▶│  Location   │
│   Screen    │     │             │     │             │     │  Permission │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Home     │◀────│   Profile   │◀────│   Select    │◀────│   Select    │
│   Screen    │     │   Setup     │     │    Zone     │     │  Language   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Flow Details:**

1. **Welcome**: App intro, value proposition
2. **Phone Entry**: Input Sierra Leone phone number (+232)
3. **OTP Verify**: 6-digit code via SMS
4. **Location Permission**: Request GPS access (optional but recommended)
5. **Language Select**: English or Krio
6. **Zone Select**: Choose neighborhood/area from list or map
7. **Profile Setup**: Name, optional profile photo
8. **Home Screen**: Main dashboard

#### 4.2.2 Supply Alert Flow (Water Scout)

```
Scout App                          Backend                        Users
    │                                 │                              │
    │  POST /alerts                   │                              │
    │  {zone, type, eta, duration}    │                              │
    ├────────────────────────────────▶│                              │
    │                                 │  Validate scout reputation   │
    │                                 │  Calculate confidence score  │
    │                                 │                              │
    │                                 │  If confidence > threshold:  │
    │                                 │  ├── Store alert             │
    │                                 │  ├── Queue notifications     │
    │                                 │  └── Update zone status      │
    │                                 │                              │
    │  201 Created                    │                              │
    │  {alert_id, points_earned}      │                              │
    │◀────────────────────────────────┤                              │
    │                                 │                              │
    │                                 │  Push Notification           │
    │                                 │  "Water coming to Kissy      │
    │                                 │   Zone 3 at 7:00 AM"         │
    │                                 ├─────────────────────────────▶│
    │                                 │                              │
    │                                 │  After supply ends:          │
    │                                 │  ├── Collect feedback        │
    │                                 │  └── Update scout reputation │
    │                                 │                              │
```

#### 4.2.3 Vendor Order Flow

```
Customer                    Backend                      Vendor                  Payment
    │                          │                           │                        │
    │ GET /vendors?nearby      │                           │                        │
    ├─────────────────────────▶│                           │                        │
    │                          │                           │                        │
    │ [vendor_list]            │                           │                        │
    │◀─────────────────────────┤                           │                        │
    │                          │                           │                        │
    │ POST /orders             │                           │                        │
    │ {vendor, items, address} │                           │                        │
    ├─────────────────────────▶│                           │                        │
    │                          │                           │                        │
    │                          │ Notify new order          │                        │
    │                          ├──────────────────────────▶│                        │
    │                          │                           │                        │
    │                          │ Accept order              │                        │
    │                          │◀──────────────────────────┤                        │
    │                          │                           │                        │
    │ Order accepted           │                           │                        │
    │ Payment required         │                           │                        │
    │◀─────────────────────────┤                           │                        │
    │                          │                           │                        │
    │ Initiate payment         │                           │                        │
    │ (Orange Money)           │                           │                        │
    ├─────────────────────────▶│                           │                        │
    │                          │ Create escrow             │                        │
    │                          ├───────────────────────────┼───────────────────────▶│
    │                          │                           │                        │
    │                          │ Payment confirmed         │                        │
    │                          │◀──────────────────────────┼────────────────────────┤
    │                          │                           │                        │
    │ Payment confirmed        │ Notify vendor             │                        │
    │◀─────────────────────────┤──────────────────────────▶│                        │
    │                          │                           │                        │
    │                          │ Mark delivered            │                        │
    │                          │◀──────────────────────────┤                        │
    │                          │                           │                        │
    │ Confirm delivery?        │                           │                        │
    │◀─────────────────────────┤                           │                        │
    │                          │                           │                        │
    │ Confirmed                │                           │                        │
    ├─────────────────────────▶│                           │                        │
    │                          │ Release escrow            │                        │
    │                          ├───────────────────────────┼───────────────────────▶│
    │                          │                           │                        │
    │ Rate vendor              │ Funds to vendor           │                        │
    │◀─────────────────────────┤◀──────────────────────────┼────────────────────────┤
    │                          │                           │                        │
```

#### 4.2.4 Leak Report Flow

```
User                        Backend                      Admin                  Guma API
    │                          │                           │                        │
    │ POST /reports            │                           │                        │
    │ {type: "leak",           │                           │                        │
    │  location, photo,        │                           │                        │
    │  description}            │                           │                        │
    ├─────────────────────────▶│                           │                        │
    │                          │                           │                        │
    │                          │ Store report              │                        │
    │                          │ Check for duplicates      │                        │
    │                          │ (nearby reports)          │                        │
    │                          │                           │                        │
    │ 201 Created              │                           │                        │
    │ {report_id, status}      │                           │                        │
    │◀─────────────────────────┤                           │                        │
    │                          │                           │                        │
    │                          │ If 3+ reports nearby:     │                        │
    │                          │ Mark as "verified"        │                        │
    │                          │ Notify admin              │                        │
    │                          ├──────────────────────────▶│                        │
    │                          │                           │                        │
    │                          │                           │ Review & approve       │
    │                          │◀──────────────────────────┤                        │
    │                          │                           │                        │
    │                          │ Forward to Guma           │                        │
    │                          ├───────────────────────────┼───────────────────────▶│
    │                          │                           │                        │
    │                          │ Guma confirms repair      │                        │
    │                          │◀──────────────────────────┼────────────────────────┤
    │                          │                           │                        │
    │ Bounty earned!           │                           │                        │
    │ +20,000 Le               │                           │                        │
    │◀─────────────────────────┤                           │                        │
    │                          │                           │                        │
```

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     USERS       │       │     ZONES       │       │   RESOURCES     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ phone           │──┐    │ name            │    ┌──│ zone_id         │
│ name            │  │    │ geometry        │◀───┘  │ type            │
│ role            │  │    │ parent_zone_id  │       │ name            │
│ language        │  │    │ water_schedule  │       │ location        │
│ reputation      │  └───▶│ created_at      │       │ status          │
│ created_at      │       └─────────────────┘       │ vendor_id       │
└────────┬────────┘                                 │ created_at      │
         │                                          └─────────────────┘
         │
         │        ┌─────────────────┐       ┌─────────────────┐
         │        │    VENDORS      │       │    PRODUCTS     │
         │        ├─────────────────┤       ├─────────────────┤
         └───────▶│ id              │       │ id              │
                  │ user_id         │◀──────│ vendor_id       │
                  │ business_name   │       │ name            │
                  │ location        │       │ unit            │
                  │ delivery_zones  │       │ price           │
                  │ rating          │       │ available       │
                  │ verified        │       │ created_at      │
                  │ created_at      │       └─────────────────┘
                  └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     ORDERS      │       │  ORDER_ITEMS    │       │  TRANSACTIONS   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ customer_id     │◀──┐   │ order_id        │◀──────│ order_id        │
│ vendor_id       │   └───│ product_id      │       │ amount          │
│ status          │       │ quantity        │       │ currency        │
│ total_amount    │       │ unit_price      │       │ provider        │
│ delivery_address│       │ created_at      │       │ status          │
│ delivery_fee    │       └─────────────────┘       │ reference       │
│ platform_fee    │                                 │ created_at      │
│ created_at      │                                 └─────────────────┘
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     ALERTS      │       │    REPORTS      │       │    RATINGS      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │       │ id              │
│ scout_id        │       │ user_id         │       │ user_id         │
│ zone_id         │       │ type            │       │ vendor_id       │
│ type            │       │ location        │       │ order_id        │
│ message         │       │ description     │       │ score           │
│ eta             │       │ photo_url       │       │ comment         │
│ duration        │       │ status          │       │ created_at      │
│ confidence      │       │ verified_count  │       └─────────────────┘
│ verified        │       │ bounty_paid     │
│ feedback_score  │       │ created_at      │
│ created_at      │       └─────────────────┘
└─────────────────┘
```

### 5.2 Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============== USERS ==============

model User {
  id            String    @id @default(cuid())
  phone         String    @unique
  name          String?
  role          UserRole  @default(CITIZEN)
  language      Language  @default(EN)
  avatarUrl     String?
  reputation    Int       @default(0)
  isVerified    Boolean   @default(false)
  isActive      Boolean   @default(true)
  
  // Relations
  primaryZoneId String?
  primaryZone   Zone?     @relation(fields: [primaryZoneId], references: [id])
  
  vendor        Vendor?
  alerts        Alert[]
  reports       Report[]
  orders        Order[]   @relation("CustomerOrders")
  ratings       Rating[]
  notifications Notification[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([phone])
  @@index([role])
}

enum UserRole {
  CITIZEN
  SCOUT
  VENDOR
  BUSINESS
  ADMIN
}

enum Language {
  EN
  KRI
}

// ============== ZONES ==============

model Zone {
  id            String    @id @default(cuid())
  name          String
  slug          String    @unique
  geometry      Json      // GeoJSON Polygon
  centroid      Json      // GeoJSON Point
  
  // Hierarchy
  parentId      String?
  parent        Zone?     @relation("ZoneHierarchy", fields: [parentId], references: [id])
  children      Zone[]    @relation("ZoneHierarchy")
  
  // Water schedule (if known)
  waterSchedule Json?     // {days: [], times: [], reliability: 0.7}
  
  // Relations
  users         User[]
  resources     Resource[]
  alerts        Alert[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([slug])
}

// ============== VENDORS ==============

model Vendor {
  id            String    @id @default(cuid())
  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id])
  
  businessName  String
  description   String?
  phone         String
  location      Json      // GeoJSON Point
  address       String?
  
  // Delivery
  deliveryZones String[]  // Array of zone IDs
  deliveryFee   Int       @default(0) // In Leones
  minOrder      Int       @default(0)
  
  // Status
  isVerified    Boolean   @default(false)
  isActive      Boolean   @default(true)
  rating        Float     @default(0)
  ratingCount   Int       @default(0)
  
  // Business hours
  openingHours  Json?     // {mon: {open: "08:00", close: "18:00"}, ...}
  
  // Relations
  products      Product[]
  orders        Order[]
  ratings       Rating[]
  resources     Resource[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([isActive, isVerified])
}

model Product {
  id            String    @id @default(cuid())
  vendorId      String
  vendor        Vendor    @relation(fields: [vendorId], references: [id])
  
  name          String
  description   String?
  unit          String    // "20L", "bucket", "tanker"
  price         Int       // In Leones
  isAvailable   Boolean   @default(true)
  
  orderItems    OrderItem[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// ============== RESOURCES ==============

model Resource {
  id            String       @id @default(cuid())
  zoneId        String
  zone          Zone         @relation(fields: [zoneId], references: [id])
  
  type          ResourceType
  name          String
  description   String?
  location      Json         // GeoJSON Point
  address       String?
  
  // Optional vendor association
  vendorId      String?
  vendor        Vendor?      @relation(fields: [vendorId], references: [id])
  
  // Status
  status        ResourceStatus @default(ACTIVE)
  lastVerified  DateTime?
  verifiedBy    String?
  
  // Metadata (type-specific)
  metadata      Json?        // {capacity: 1000, hasElectricity: true, ...}
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  @@index([zoneId, type])
  @@index([status])
}

enum ResourceType {
  WATER_TAP
  BOREHOLE
  WELL
  WATER_KIOSK
  SOLAR_CHARGER
  BATTERY_RENTAL
  WATER_VENDOR
  TANKER_STATION
}

enum ResourceStatus {
  ACTIVE
  INACTIVE
  UNDER_REPAIR
  UNVERIFIED
}

// ============== ORDERS ==============

model Order {
  id              String      @id @default(cuid())
  orderNumber     String      @unique @default(cuid())
  
  customerId      String
  customer        User        @relation("CustomerOrders", fields: [customerId], references: [id])
  
  vendorId        String
  vendor          Vendor      @relation(fields: [vendorId], references: [id])
  
  status          OrderStatus @default(PENDING)
  
  // Delivery
  deliveryAddress String
  deliveryLocation Json?      // GeoJSON Point
  deliveryNotes   String?
  
  // Pricing
  subtotal        Int         // In Leones
  deliveryFee     Int
  platformFee     Int
  totalAmount     Int
  
  // Timestamps
  acceptedAt      DateTime?
  deliveredAt     DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  cancelReason    String?
  
  // Relations
  items           OrderItem[]
  transaction     Transaction?
  rating          Rating?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@index([customerId])
  @@index([vendorId])
  @@index([status])
}

enum OrderStatus {
  PENDING
  ACCEPTED
  PAYMENT_PENDING
  PAID
  PREPARING
  OUT_FOR_DELIVERY
  DELIVERED
  COMPLETED
  CANCELLED
  REFUNDED
}

model OrderItem {
  id            String    @id @default(cuid())
  orderId       String
  order         Order     @relation(fields: [orderId], references: [id])
  
  productId     String
  product       Product   @relation(fields: [productId], references: [id])
  
  quantity      Int
  unitPrice     Int
  totalPrice    Int
  
  createdAt     DateTime  @default(now())
}

// ============== TRANSACTIONS ==============

model Transaction {
  id            String            @id @default(cuid())
  orderId       String            @unique
  order         Order             @relation(fields: [orderId], references: [id])
  
  amount        Int
  currency      String            @default("SLL")
  
  provider      PaymentProvider
  providerRef   String?           // External reference
  
  status        TransactionStatus @default(PENDING)
  
  // Escrow
  escrowStatus  EscrowStatus      @default(NONE)
  escrowReleasedAt DateTime?
  
  // Metadata
  metadata      Json?
  
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  
  @@index([provider, providerRef])
  @@index([status])
}

enum PaymentProvider {
  ORANGE_MONEY
  AFRICELL_MONEY
  CASH
}

enum TransactionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REFUNDED
}

enum EscrowStatus {
  NONE
  HELD
  RELEASED
  REFUNDED
}

// ============== ALERTS ==============

model Alert {
  id            String      @id @default(cuid())
  
  scoutId       String
  scout         User        @relation(fields: [scoutId], references: [id])
  
  zoneId        String
  zone          Zone        @relation(fields: [zoneId], references: [id])
  
  type          AlertType
  message       String?
  
  // Timing
  eta           DateTime?   // Expected time of arrival
  duration      Int?        // Expected duration in minutes
  
  // Verification
  confidence    Float       @default(0.5) // 0-1 score
  isVerified    Boolean     @default(false)
  
  // Feedback
  feedbackScore Float?      // Average accuracy rating
  feedbackCount Int         @default(0)
  
  // Status
  status        AlertStatus @default(ACTIVE)
  expiresAt     DateTime?
  
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  @@index([zoneId, status])
  @@index([scoutId])
}

enum AlertType {
  WATER_COMING
  WATER_ACTIVE
  WATER_ENDED
  SHORTAGE_WARNING
  FLOOD_WARNING
  TANKER_AVAILABLE
}

enum AlertStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  VERIFIED
}

// ============== REPORTS ==============

model Report {
  id            String        @id @default(cuid())
  
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  
  type          ReportType
  description   String?
  location      Json          // GeoJSON Point
  address       String?
  
  // Media
  photoUrls     String[]
  
  // Verification
  status        ReportStatus  @default(PENDING)
  verifiedCount Int           @default(0) // Number of similar reports nearby
  
  // Bounty
  bountyAmount  Int?
  bountyPaid    Boolean       @default(false)
  bountyPaidAt  DateTime?
  
  // Resolution
  resolvedAt    DateTime?
  resolvedBy    String?
  resolution    String?
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  @@index([type, status])
  @@index([userId])
}

enum ReportType {
  LEAK
  BURST_PIPE
  CONTAMINATION
  BLOCKED_DRAIN
  FLOOD
  BROKEN_TAP
  OTHER
}

enum ReportStatus {
  PENDING
  VERIFIED
  FORWARDED
  IN_PROGRESS
  RESOLVED
  REJECTED
}

// ============== RATINGS ==============

model Rating {
  id            String    @id @default(cuid())
  
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  
  vendorId      String
  vendor        Vendor    @relation(fields: [vendorId], references: [id])
  
  orderId       String    @unique
  order         Order     @relation(fields: [orderId], references: [id])
  
  score         Int       // 1-5
  comment       String?
  
  // Specific ratings
  qualityScore  Int?      // Water quality
  serviceScore  Int?      // Delivery service
  
  createdAt     DateTime  @default(now())
  
  @@index([vendorId])
}

// ============== NOTIFICATIONS ==============

model Notification {
  id            String              @id @default(cuid())
  
  userId        String
  user          User                @relation(fields: [userId], references: [id])
  
  type          NotificationType
  title         String
  body          String
  data          Json?
  
  channel       NotificationChannel
  
  isRead        Boolean             @default(false)
  readAt        DateTime?
  
  createdAt     DateTime            @default(now())
  
  @@index([userId, isRead])
}

enum NotificationType {
  ALERT
  ORDER_UPDATE
  PAYMENT
  REPORT_UPDATE
  BOUNTY
  SYSTEM
}

enum NotificationChannel {
  PUSH
  SMS
  IN_APP
}
```

---

## 6. API Specification

### 6.1 API Overview

**Base URL:** `https://api.maji.app/v1`

**Authentication:** Bearer token (JWT)

**Content-Type:** `application/json`

**Rate Limiting:**
- Anonymous: 20 requests/minute
- Authenticated: 100 requests/minute
- Vendor: 200 requests/minute

### 6.2 Authentication Endpoints

#### POST /auth/otp/request
Request OTP for phone number.

```json
// Request
{
  "phone": "+23276123456"
}

// Response 200
{
  "success": true,
  "message": "OTP sent",
  "expiresIn": 300
}
```

#### POST /auth/otp/verify
Verify OTP and get access token.

```json
// Request
{
  "phone": "+23276123456",
  "otp": "123456"
}

// Response 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400,
  "user": {
    "id": "usr_abc123",
    "phone": "+23276123456",
    "name": null,
    "role": "CITIZEN",
    "isNewUser": true
  }
}
```

#### POST /auth/refresh
Refresh access token.

```json
// Request
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

// Response 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400
}
```

### 6.3 User Endpoints

#### GET /users/me
Get current user profile.

```json
// Response 200
{
  "id": "usr_abc123",
  "phone": "+23276123456",
  "name": "Aminata",
  "role": "CITIZEN",
  "language": "EN",
  "avatarUrl": "https://cdn.maji.app/avatars/abc123.jpg",
  "reputation": 150,
  "primaryZone": {
    "id": "zone_kissy3",
    "name": "Kissy Zone 3"
  },
  "stats": {
    "ordersCount": 12,
    "reportsCount": 3,
    "alertsCount": 0
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### PATCH /users/me
Update user profile.

```json
// Request
{
  "name": "Aminata Kamara",
  "language": "KRI",
  "primaryZoneId": "zone_kissy3"
}

// Response 200
{
  "id": "usr_abc123",
  "name": "Aminata Kamara",
  "language": "KRI",
  // ... full user object
}
```

#### POST /users/me/avatar
Upload avatar image.

```
// Request (multipart/form-data)
avatar: [binary file]

// Response 200
{
  "avatarUrl": "https://cdn.maji.app/avatars/abc123.jpg"
}
```

### 6.4 Zone Endpoints

#### GET /zones
List all zones.

```json
// Query params
?parentId=zone_freetown  // Filter by parent
&search=kissy            // Search by name

// Response 200
{
  "data": [
    {
      "id": "zone_kissy3",
      "name": "Kissy Zone 3",
      "slug": "kissy-zone-3",
      "parentId": "zone_kissy",
      "centroid": {
        "type": "Point",
        "coordinates": [-13.2234, 8.4891]
      },
      "waterSchedule": {
        "days": ["monday", "thursday"],
        "times": ["06:00-10:00"],
        "reliability": 0.7
      },
      "stats": {
        "usersCount": 1250,
        "vendorsCount": 8,
        "activeAlerts": 1
      }
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20
  }
}
```

#### GET /zones/:id
Get zone details.

```json
// Response 200
{
  "id": "zone_kissy3",
  "name": "Kissy Zone 3",
  "slug": "kissy-zone-3",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[...]]]
  },
  "centroid": {
    "type": "Point",
    "coordinates": [-13.2234, 8.4891]
  },
  "parent": {
    "id": "zone_kissy",
    "name": "Kissy"
  },
  "waterSchedule": {...},
  "currentStatus": {
    "hasWater": false,
    "lastSupply": "2024-01-15T08:30:00Z",
    "nextExpected": "2024-01-18T06:00:00Z",
    "activeAlerts": [...]
  }
}
```

### 6.5 Alert Endpoints

#### GET /alerts
Get alerts for user's zone(s).

```json
// Query params
?zoneId=zone_kissy3     // Filter by zone
&type=WATER_COMING      // Filter by type
&status=ACTIVE          // Filter by status
&limit=20

// Response 200
{
  "data": [
    {
      "id": "alert_xyz789",
      "type": "WATER_COMING",
      "message": "Water supply expected",
      "zone": {
        "id": "zone_kissy3",
        "name": "Kissy Zone 3"
      },
      "scout": {
        "id": "usr_scout1",
        "name": "Ibrahim",
        "reputation": 450
      },
      "eta": "2024-01-18T07:00:00Z",
      "duration": 120,
      "confidence": 0.85,
      "isVerified": true,
      "status": "ACTIVE",
      "createdAt": "2024-01-18T05:30:00Z"
    }
  ]
}
```

#### POST /alerts
Create new alert (Scout only).

```json
// Request
{
  "zoneId": "zone_kissy3",
  "type": "WATER_COMING",
  "message": "Valve operator confirmed supply",
  "eta": "2024-01-18T07:00:00Z",
  "duration": 120
}

// Response 201
{
  "id": "alert_xyz789",
  "type": "WATER_COMING",
  "confidence": 0.75,
  "pointsEarned": 10,
  // ... full alert object
}
```

#### POST /alerts/:id/feedback
Submit feedback on alert accuracy.

```json
// Request
{
  "accurate": true,
  "actualStartTime": "2024-01-18T07:15:00Z",
  "actualDuration": 110,
  "comment": "Arrived 15 min late but good supply"
}

// Response 200
{
  "success": true,
  "updatedConfidence": 0.82
}
```

### 6.6 Vendor Endpoints

#### GET /vendors
List vendors.

```json
// Query params
?lat=-13.2234&lng=8.4891  // Near location
&radius=2000              // Meters
&zoneId=zone_kissy3       // In zone
&isOpen=true              // Currently open
&minRating=4              // Minimum rating
&sort=distance            // distance|rating|price
&limit=20

// Response 200
{
  "data": [
    {
      "id": "vnd_abc123",
      "businessName": "Abu Water Supply",
      "phone": "+23276111222",
      "location": {
        "type": "Point",
        "coordinates": [-13.2256, 8.4912]
      },
      "address": "15 Main Street, Kissy",
      "distance": 450,
      "rating": 4.5,
      "ratingCount": 128,
      "isVerified": true,
      "isOpen": true,
      "deliveryFee": 5000,
      "minOrder": 10000,
      "products": [
        {
          "id": "prd_water20l",
          "name": "20L Jerry Can",
          "unit": "20L",
          "price": 5000,
          "isAvailable": true
        }
      ],
      "openingHours": {
        "monday": {"open": "06:00", "close": "20:00"},
        // ...
      }
    }
  ]
}
```

#### GET /vendors/:id
Get vendor details.

```json
// Response 200
{
  "id": "vnd_abc123",
  "businessName": "Abu Water Supply",
  "description": "Reliable water delivery since 2018",
  // ... full vendor details
  "products": [...],
  "reviews": {
    "average": 4.5,
    "count": 128,
    "distribution": {
      "5": 80,
      "4": 30,
      "3": 10,
      "2": 5,
      "1": 3
    },
    "recent": [
      {
        "id": "rtg_xyz",
        "score": 5,
        "comment": "Always on time!",
        "user": {"name": "Fatmata"},
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ]
  }
}
```

### 6.7 Order Endpoints

#### POST /orders
Create new order.

```json
// Request
{
  "vendorId": "vnd_abc123",
  "items": [
    {
      "productId": "prd_water20l",
      "quantity": 4
    }
  ],
  "deliveryAddress": "25 Station Road, Kissy Zone 3",
  "deliveryLocation": {
    "type": "Point",
    "coordinates": [-13.2245, 8.4905]
  },
  "deliveryNotes": "Yellow gate, next to mosque"
}

// Response 201
{
  "id": "ord_abc123",
  "orderNumber": "MJ-2024-0001",
  "status": "PENDING",
  "vendor": {
    "id": "vnd_abc123",
    "businessName": "Abu Water Supply",
    "phone": "+23276111222"
  },
  "items": [
    {
      "product": {"name": "20L Jerry Can"},
      "quantity": 4,
      "unitPrice": 5000,
      "totalPrice": 20000
    }
  ],
  "subtotal": 20000,
  "deliveryFee": 5000,
  "platformFee": 1000,
  "totalAmount": 26000,
  "deliveryAddress": "25 Station Road, Kissy Zone 3",
  "createdAt": "2024-01-18T10:30:00Z"
}
```

#### GET /orders/:id
Get order details.

```json
// Response 200
{
  "id": "ord_abc123",
  "orderNumber": "MJ-2024-0001",
  "status": "OUT_FOR_DELIVERY",
  // ... full order details
  "timeline": [
    {"status": "PENDING", "timestamp": "2024-01-18T10:30:00Z"},
    {"status": "ACCEPTED", "timestamp": "2024-01-18T10:32:00Z"},
    {"status": "PAID", "timestamp": "2024-01-18T10:35:00Z"},
    {"status": "OUT_FOR_DELIVERY", "timestamp": "2024-01-18T10:45:00Z"}
  ],
  "estimatedDelivery": "2024-01-18T11:15:00Z"
}
```

#### PATCH /orders/:id/status
Update order status (Vendor only).

```json
// Request
{
  "status": "OUT_FOR_DELIVERY"
}

// Response 200
{
  "id": "ord_abc123",
  "status": "OUT_FOR_DELIVERY",
  // ... updated order
}
```

#### POST /orders/:id/confirm-delivery
Customer confirms delivery.

```json
// Request
{
  "confirmed": true
}

// Response 200
{
  "success": true,
  "message": "Delivery confirmed. Payment released to vendor."
}
```

### 6.8 Payment Endpoints

#### POST /payments/initiate
Initiate payment for order.

```json
// Request
{
  "orderId": "ord_abc123",
  "provider": "ORANGE_MONEY",
  "phone": "+23276123456"
}

// Response 200
{
  "transactionId": "txn_xyz789",
  "status": "PENDING",
  "provider": "ORANGE_MONEY",
  "amount": 26000,
  "currency": "SLL",
  "instructions": "Dial *144*4*6# to approve payment",
  "expiresAt": "2024-01-18T10:45:00Z"
}
```

#### GET /payments/:id/status
Check payment status.

```json
// Response 200
{
  "transactionId": "txn_xyz789",
  "status": "COMPLETED",
  "provider": "ORANGE_MONEY",
  "providerRef": "OM123456789",
  "amount": 26000,
  "completedAt": "2024-01-18T10:36:00Z"
}
```

### 6.9 Resource (Map) Endpoints

#### GET /resources
Get resources for map.

```json
// Query params
?lat=-13.2234&lng=8.4891  // Near location
&radius=3000              // Meters
&types=WATER_TAP,BOREHOLE,WATER_VENDOR  // Filter types
&status=ACTIVE            // Filter status
&bbox=-13.25,8.48,-13.20,8.50  // Bounding box

// Response 200
{
  "data": [
    {
      "id": "res_tap001",
      "type": "WATER_TAP",
      "name": "Kissy Road Public Tap",
      "location": {
        "type": "Point",
        "coordinates": [-13.2240, 8.4895]
      },
      "address": "Kissy Road, near market",
      "status": "ACTIVE",
      "lastVerified": "2024-01-15T08:00:00Z",
      "metadata": {
        "hasQueue": false,
        "estimatedWait": 10
      }
    },
    {
      "id": "res_solar001",
      "type": "SOLAR_CHARGER",
      "name": "Bright Solar Station",
      "location": {...},
      "status": "ACTIVE",
      "vendor": {
        "id": "vnd_solar1",
        "businessName": "Bright Solar"
      },
      "metadata": {
        "pricePerHour": 1000,
        "availablePorts": 4
      }
    }
  ],
  "meta": {
    "total": 23,
    "bbox": [-13.25, 8.48, -13.20, 8.50]
  }
}
```

#### POST /resources
Add new resource (Community contribution).

```json
// Request
{
  "type": "BOREHOLE",
  "name": "Community Borehole",
  "location": {
    "type": "Point",
    "coordinates": [-13.2260, 8.4920]
  },
  "address": "Behind St. John's Church",
  "metadata": {
    "isPublic": true,
    "operatingHours": "06:00-18:00"
  }
}

// Response 201
{
  "id": "res_bh001",
  "type": "BOREHOLE",
  "status": "UNVERIFIED",
  "pointsEarned": 5,
  // ... full resource
}
```

### 6.10 Report Endpoints

#### POST /reports
Submit a report (leak, blockage, etc.).

```json
// Request (multipart/form-data)
{
  "type": "LEAK",
  "description": "Large leak from main pipe, water flowing into street",
  "location": {
    "type": "Point",
    "coordinates": [-13.2245, 8.4900]
  },
  "address": "Junction of Kissy Road and Market Street",
  "photos": [/* binary files */]
}

// Response 201
{
  "id": "rpt_abc123",
  "type": "LEAK",
  "status": "PENDING",
  "description": "Large leak from main pipe...",
  "location": {...},
  "photoUrls": [
    "https://cdn.maji.app/reports/rpt_abc123_1.jpg"
  ],
  "potentialBounty": 20000,
  "message": "Report submitted. You may earn 20,000 Le if verified and repaired.",
  "createdAt": "2024-01-18T09:30:00Z"
}
```

#### GET /reports/mine
Get user's reports.

```json
// Response 200
{
  "data": [
    {
      "id": "rpt_abc123",
      "type": "LEAK",
      "status": "VERIFIED",
      "bountyAmount": 20000,
      "bountyPaid": false,
      "createdAt": "2024-01-18T09:30:00Z"
    }
  ],
  "stats": {
    "total": 5,
    "verified": 3,
    "bountyEarned": 40000
  }
}
```

---

## 7. External Integrations

### 7.1 Mobile Money Integration

#### 7.1.1 Orange Money Sierra Leone

**API Documentation:** Orange Money Open API

**Integration Method:** REST API with OAuth 2.0

**Sandbox:** Available for testing

```javascript
// Orange Money Configuration
const orangeMoneyConfig = {
  baseUrl: 'https://api.orange.com/orange-money-webpay/sl/v1',
  authUrl: 'https://api.orange.com/oauth/v3/token',
  clientId: process.env.ORANGE_CLIENT_ID,
  clientSecret: process.env.ORANGE_CLIENT_SECRET,
  merchantCode: process.env.ORANGE_MERCHANT_CODE,
};

// Payment Request Flow
async function initiateOrangeMoneyPayment(order, customerPhone) {
  // 1. Get access token
  const token = await getOrangeAccessToken();
  
  // 2. Create payment request
  const response = await fetch(`${orangeMoneyConfig.baseUrl}/webpayment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchant_key: orangeMoneyConfig.merchantCode,
      currency: 'SLL',
      order_id: order.orderNumber,
      amount: order.totalAmount,
      return_url: `https://api.maji.app/v1/payments/callback/orange`,
      cancel_url: `https://api.maji.app/v1/payments/cancel/orange`,
      notif_url: `https://api.maji.app/v1/webhooks/orange-money`,
      lang: 'en',
      reference: order.id,
    }),
  });
  
  return response.json();
}

// Webhook Handler
app.post('/webhooks/orange-money', async (req, res) => {
  const { status, order_id, txnid, amount } = req.body;
  
  // Verify signature
  if (!verifyOrangeSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Update transaction
  await updateTransaction(order_id, {
    status: status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
    providerRef: txnid,
  });
  
  // If successful, update order and notify
  if (status === 'SUCCESS') {
    await updateOrderStatus(order_id, 'PAID');
    await notifyVendor(order_id, 'Payment received');
    await notifyCustomer(order_id, 'Payment confirmed');
  }
  
  res.json({ status: 'received' });
});
```

#### 7.1.2 Africell Money

**API Documentation:** Africell Mobile Money API

**Integration Method:** REST API

```javascript
// Africell Money Configuration
const africellConfig = {
  baseUrl: 'https://api.africellmoney.com/v1',
  apiKey: process.env.AFRICELL_API_KEY,
  merchantId: process.env.AFRICELL_MERCHANT_ID,
};

// Collection Request
async function initiateAfricellPayment(order, customerPhone) {
  const response = await fetch(`${africellConfig.baseUrl}/collection`, {
    method: 'POST',
    headers: {
      'X-API-Key': africellConfig.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      merchant_id: africellConfig.merchantId,
      phone_number: customerPhone,
      amount: order.totalAmount,
      currency: 'SLL',
      external_id: order.id,
      callback_url: 'https://api.maji.app/v1/webhooks/africell',
      description: `Maji Order ${order.orderNumber}`,
    }),
  });
  
  return response.json();
}
```

### 7.2 SMS Gateway

#### Africa's Talking

**Services Used:** SMS, USSD

```javascript
// Africa's Talking Configuration
const AfricasTalking = require('africastalking');

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = at.SMS;
const ussd = at.USSD;

// Send SMS
async function sendSMS(phone, message) {
  try {
    const result = await sms.send({
      to: [phone],
      message: message,
      from: 'MAJI', // Sender ID (requires registration)
    });
    return result;
  } catch (error) {
    console.error('SMS Error:', error);
    throw error;
  }
}

// SMS Templates
const smsTemplates = {
  alert: (zone, time) => 
    `MAJI: Water coming to ${zone} at ${time}. Prepare your containers!`,
  
  orderConfirmed: (orderNum, vendor) =>
    `MAJI: Order ${orderNum} confirmed! ${vendor} will deliver soon.`,
  
  paymentReceived: (amount, orderNum) =>
    `MAJI: Payment of ${amount} Le received for order ${orderNum}.`,
  
  bountyEarned: (amount) =>
    `MAJI: Congratulations! You earned ${amount} Le for your verified report.`,
    
  otp: (code) =>
    `MAJI: Your verification code is ${code}. Valid for 5 minutes.`,
};
```

### 7.3 Push Notifications

#### Firebase Cloud Messaging (FCM)

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Send Push Notification
async function sendPushNotification(userId, notification) {
  // Get user's FCM tokens
  const tokens = await getUserFCMTokens(userId);
  
  if (tokens.length === 0) return;
  
  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: notification.data,
    tokens: tokens,
    android: {
      priority: 'high',
      notification: {
        channelId: notification.channel || 'default',
        icon: 'ic_notification',
        color: '#0A4D68',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: notification.badge || 0,
          sound: 'default',
        },
      },
    },
  };
  
  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(`Sent to ${response.successCount}/${tokens.length} devices`);
    return response;
  } catch (error) {
    console.error('FCM Error:', error);
    throw error;
  }
}

// Notification Channels (Android)
const notificationChannels = {
  alerts: {
    id: 'water_alerts',
    name: 'Water Alerts',
    importance: 'high',
    sound: 'water_alert.mp3',
  },
  orders: {
    id: 'orders',
    name: 'Order Updates',
    importance: 'default',
  },
  reports: {
    id: 'reports',
    name: 'Report Updates',
    importance: 'low',
  },
};
```

### 7.4 Maps & Geocoding

#### Mapbox / OpenStreetMap

```javascript
// Mapbox Configuration
const mapboxConfig = {
  accessToken: process.env.MAPBOX_ACCESS_TOKEN,
  style: 'mapbox://styles/maji/custom-freetown',
  offlinePacks: [
    {
      name: 'freetown',
      bounds: [[-13.35, 8.35], [-13.15, 8.55]],
      minZoom: 10,
      maxZoom: 17,
    },
  ],
};

// Geocoding (Address to Coordinates)
async function geocodeAddress(address) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?` +
    `access_token=${mapboxConfig.accessToken}&` +
    `country=SL&` +
    `proximity=-13.23,8.48&` +
    `limit=5`
  );
  
  const data = await response.json();
  return data.features.map(f => ({
    address: f.place_name,
    coordinates: f.center,
    relevance: f.relevance,
  }));
}

// Reverse Geocoding (Coordinates to Address)
async function reverseGeocode(lng, lat) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
    `access_token=${mapboxConfig.accessToken}&` +
    `types=address,poi&` +
    `limit=1`
  );
  
  const data = await response.json();
  return data.features[0]?.place_name || null;
}

// Distance Calculation
function calculateDistance(point1, point2) {
  // Haversine formula
  const R = 6371e3; // Earth radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}
```

---

## 8. Offline-First Architecture

### 8.1 Offline Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST STRATEGY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Data Classification:                                            │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ALWAYS OFFLINE  │  │ CACHE + SYNC    │  │  ONLINE ONLY    │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤ │
│  │ • User profile  │  │ • Zone data     │  │ • Live alerts   │ │
│  │ • Saved vendors │  │ • Vendor list   │  │ • Payment       │ │
│  │ • My orders     │  │ • Products      │  │ • Real-time     │ │
│  │ • My reports    │  │ • Resources map │  │   vendor status │ │
│  │ • Offline maps  │  │ • Notifications │  │ • Chat          │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  Sync Strategy:                                                  │
│  • On app open: Sync critical data (alerts, orders)             │
│  • Every 15 min: Background sync (if connected)                 │
│  • On action: Queue for sync (orders, reports)                  │
│  • On reconnect: Process sync queue                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 WatermelonDB Schema (React Native)

```javascript
// database/schema.js
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'phone', type: 'string' },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'role', type: 'string' },
        { name: 'reputation', type: 'number' },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'primary_zone_id', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    
    tableSchema({
      name: 'zones',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'slug', type: 'string' },
        { name: 'parent_id', type: 'string', isOptional: true },
        { name: 'centroid_lng', type: 'number' },
        { name: 'centroid_lat', type: 'number' },
        { name: 'water_schedule', type: 'string', isOptional: true }, // JSON
        { name: 'synced_at', type: 'number' },
      ],
    }),
    
    tableSchema({
      name: 'vendors',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'business_name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'location_lng', type: 'number' },
        { name: 'location_lat', type: 'number' },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'rating', type: 'number' },
        { name: 'is_verified', type: 'boolean' },
        { name: 'is_favorited', type: 'boolean' },
        { name: 'products', type: 'string' }, // JSON array
        { name: 'synced_at', type: 'number' },
      ],
    }),
    
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'order_number', type: 'string' },
        { name: 'vendor_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' },
        { name: 'total_amount', type: 'number' },
        { name: 'delivery_address', type: 'string' },
        { name: 'items', type: 'string' }, // JSON array
        { name: 'is_synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
    
    tableSchema({
      name: 'alerts',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'zone_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'message', type: 'string', isOptional: true },
        { name: 'eta', type: 'number', isOptional: true },
        { name: 'confidence', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    
    tableSchema({
      name: 'resources',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'zone_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'location_lng', type: 'number' },
        { name: 'location_lat', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'metadata', type: 'string', isOptional: true }, // JSON
        { name: 'synced_at', type: 'number' },
      ],
    }),
    
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'action', type: 'string' }, // CREATE, UPDATE, DELETE
        { name: 'table_name', type: 'string' },
        { name: 'record_id', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON
        { name: 'attempts', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
```

### 8.3 Sync Service

```javascript
// services/syncService.js
import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../database';
import { api } from './api';
import NetInfo from '@react-native-community/netinfo';

class SyncService {
  isOnline = false;
  isSyncing = false;
  
  constructor() {
    // Monitor connectivity
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      // Sync when coming back online
      if (wasOffline && this.isOnline) {
        this.sync();
      }
    });
  }
  
  async sync() {
    if (this.isSyncing || !this.isOnline) return;
    
    this.isSyncing = true;
    
    try {
      await synchronize({
        database,
        
        pullChanges: async ({ lastPulledAt }) => {
          const response = await api.get('/sync/pull', {
            params: { lastPulledAt },
          });
          
          return {
            changes: response.data.changes,
            timestamp: response.data.timestamp,
          };
        },
        
        pushChanges: async ({ changes, lastPulledAt }) => {
          await api.post('/sync/push', {
            changes,
            lastPulledAt,
          });
        },
        
        migrationsEnabledAtVersion: 1,
      });
      
      // Process offline queue after sync
      await this.processOfflineQueue();
      
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }
  
  async processOfflineQueue() {
    const queue = await database.get('sync_queue').query().fetch();
    
    for (const item of queue) {
      try {
        await this.processQueueItem(item);
        await item.destroyPermanently();
      } catch (error) {
        // Increment attempts, retry later
        await database.write(async () => {
          await item.update(record => {
            record.attempts += 1;
          });
        });
      }
    }
  }
  
  async processQueueItem(item) {
    const { action, table_name, payload } = item;
    const data = JSON.parse(payload);
    
    switch (`${action}:${table_name}`) {
      case 'CREATE:orders':
        await api.post('/orders', data);
        break;
      case 'CREATE:reports':
        await api.post('/reports', data);
        break;
      case 'CREATE:alerts':
        await api.post('/alerts', data);
        break;
      // ... other cases
    }
  }
  
  // Queue action for later sync
  async queueAction(action, tableName, recordId, payload) {
    await database.write(async () => {
      await database.get('sync_queue').create(record => {
        record.action = action;
        record.table_name = tableName;
        record.record_id = recordId;
        record.payload = JSON.stringify(payload);
        record.attempts = 0;
        record.created_at = Date.now();
      });
    });
  }
}

export const syncService = new SyncService();
```

---

## 9. Security & Authentication

### 9.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Phone Number Entry                                          │
│     └── Validate Sierra Leone format (+232XXXXXXXX)             │
│                                                                  │
│  2. OTP Generation                                              │
│     ├── Generate 6-digit code                                   │
│     ├── Store hash in Redis (5 min TTL)                         │
│     ├── Rate limit: 3 requests/phone/hour                       │
│     └── Send via SMS (Africa's Talking)                         │
│                                                                  │
│  3. OTP Verification                                            │
│     ├── Compare with stored hash                                │
│     ├── Max 3 attempts per code                                 │
│     ├── Clear on success or expiry                              │
│     └── Issue JWT tokens on success                             │
│                                                                  │
│  4. Token Management                                            │
│     ├── Access Token: 24 hours, JWT                             │
│     ├── Refresh Token: 30 days, opaque + stored                 │
│     └── Rotation on refresh                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 JWT Structure

```javascript
// Access Token Payload
{
  sub: "usr_abc123",        // User ID
  phone: "+23276123456",    // Phone number
  role: "CITIZEN",          // User role
  iat: 1705567200,          // Issued at
  exp: 1705653600,          // Expires (24h)
  jti: "tok_xyz789"         // Token ID (for revocation)
}

// JWT Configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  algorithm: 'HS256',
  accessTokenTTL: '24h',
  refreshTokenTTL: '30d',
};

// Token Generation
function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    },
    jwtConfig.secret,
    {
      algorithm: jwtConfig.algorithm,
      expiresIn: jwtConfig.accessTokenTTL,
      jwtid: generateTokenId(),
    }
  );
  
  const refreshToken = generateSecureToken();
  
  // Store refresh token in database
  await storeRefreshToken(user.id, refreshToken, '30d');
  
  return { accessToken, refreshToken };
}
```

### 9.3 Security Measures

```javascript
// Security Middleware Stack

// 1. Rate Limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    if (!req.user) return 20;           // Anonymous
    if (req.user.role === 'VENDOR') return 200;
    return 100;                          // Authenticated
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// 2. Input Validation (Zod schemas)
const createOrderSchema = z.object({
  vendorId: z.string().cuid(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(20),
  deliveryAddress: z.string().min(5).max(200),
  deliveryLocation: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  }).optional(),
  deliveryNotes: z.string().max(500).optional(),
});

// 3. SQL Injection Prevention (Prisma parameterized queries)
// Prisma handles this automatically

// 4. XSS Prevention
const sanitizeHtml = require('sanitize-html');

function sanitizeInput(input) {
  if (typeof input === 'string') {
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }
  return input;
}

// 5. CORS Configuration
const corsOptions = {
  origin: [
    'https://maji.app',
    'https://admin.maji.app',
    /\.maji\.app$/,
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

// 6. Helmet Security Headers
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'https://cdn.maji.app', 'https://api.mapbox.com'],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// 7. Request Logging (for audit)
const morgan = require('morgan');

morgan.token('user', (req) => req.user?.id || 'anonymous');
app.use(morgan(':method :url :status :response-time ms - :user'));
```

---

## 10. USSD Integration

### 10.1 USSD Flow Design

```
*232# - Maji Main Menu
│
├── 1. Water Alerts
│   ├── 1. View Current Alerts
│   │   └── [Zone]: Water coming at [time]
│   │       └── 0. Back
│   │
│   └── 2. Report Water (Scout)
│       ├── Enter zone code: ___
│       ├── Status: 1.Coming 2.Active 3.Ended
│       ├── Expected time: ___
│       └── Confirmed! Points: +10
│
├── 2. Find Water Vendor
│   ├── Enter zone: ___
│   │   └── 1. Abu Water (500m) - 5000Le/20L
│   │       ├── 1. Order Now
│   │       │   ├── Quantity (20L): ___
│   │       │   ├── Confirm: 4x5000=20000Le
│   │       │   └── Pay: 1.OrangeMoney 2.Africell
│   │       └── 2. Call Vendor
│   │
│   └── 2. [Next vendor]
│
├── 3. Report Problem
│   ├── Type: 1.Leak 2.Burst 3.Blocked Drain
│   ├── Location: Enter landmark ___
│   └── Submitted! Ref: RPT-001
│
├── 4. My Orders
│   └── [List of recent orders with status]
│
├── 5. My Account
│   ├── 1. Balance: 15,000 Le
│   ├── 2. Change Zone
│   └── 3. Change Language
│
└── 0. Exit
```

### 10.2 Africa's Talking USSD Implementation

```javascript
// ussd/handler.js
const express = require('express');
const router = express.Router();

// Session store (Redis in production)
const sessions = new Map();

router.post('/ussd', async (req, res) => {
  const {
    sessionId,
    serviceCode,
    phoneNumber,
    text,
  } = req.body;
  
  // Get or create session
  let session = sessions.get(sessionId) || {
    step: 'MAIN_MENU',
    data: {},
    user: await getUserByPhone(phoneNumber),
  };
  
  // Process input
  const response = await processUSSD(session, text);
  
  // Update session
  sessions.set(sessionId, session);
  
  // Clean up ended sessions
  if (response.startsWith('END ')) {
    sessions.delete(sessionId);
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(response);
});

async function processUSSD(session, input) {
  const inputs = input.split('*');
  const lastInput = inputs[inputs.length - 1];
  
  switch (session.step) {
    case 'MAIN_MENU':
      return handleMainMenu(session, lastInput);
      
    case 'ALERTS_MENU':
      return handleAlertsMenu(session, lastInput);
      
    case 'VIEW_ALERTS':
      return handleViewAlerts(session, lastInput);
      
    case 'VENDOR_SEARCH':
      return handleVendorSearch(session, lastInput);
      
    case 'VENDOR_LIST':
      return handleVendorList(session, lastInput);
      
    case 'ORDER_QUANTITY':
      return handleOrderQuantity(session, lastInput);
      
    case 'ORDER_CONFIRM':
      return handleOrderConfirm(session, lastInput);
      
    case 'PAYMENT_SELECT':
      return handlePaymentSelect(session, lastInput);
      
    case 'REPORT_TYPE':
      return handleReportType(session, lastInput);
      
    case 'REPORT_LOCATION':
      return handleReportLocation(session, lastInput);
      
    default:
      session.step = 'MAIN_MENU';
      return getMainMenu(session);
  }
}

function getMainMenu(session) {
  const name = session.user?.name || 'User';
  return `CON Welcome to Maji, ${name}!
  
1. Water Alerts
2. Find Water Vendor
3. Report Problem
4. My Orders
5. My Account
0. Exit`;
}

function handleMainMenu(session, input) {
  switch (input) {
    case '1':
      session.step = 'ALERTS_MENU';
      return `CON Water Alerts
      
1. View Current Alerts
2. Report Water (Scout only)
0. Back`;
      
    case '2':
      session.step = 'VENDOR_SEARCH';
      return `CON Find Water Vendor

Enter zone code or name:`;
      
    case '3':
      session.step = 'REPORT_TYPE';
      return `CON Report Problem

1. Water Leak
2. Burst Pipe
3. Blocked Drain
4. Other
0. Back`;
      
    case '4':
      return handleMyOrders(session);
      
    case '5':
      return handleMyAccount(session);
      
    case '0':
      return 'END Thank you for using Maji!';
      
    default:
      return getMainMenu(session);
  }
}

async function handleViewAlerts(session, input) {
  if (input === '0') {
    session.step = 'ALERTS_MENU';
    return `CON Water Alerts
    
1. View Current Alerts
2. Report Water
0. Back`;
  }
  
  const zoneId = session.user?.primaryZoneId;
  const alerts = await getActiveAlerts(zoneId);
  
  if (alerts.length === 0) {
    return `CON No active alerts for your zone.

0. Back`;
  }
  
  let response = 'CON Active Alerts:\n\n';
  alerts.slice(0, 3).forEach((alert, i) => {
    const time = formatTime(alert.eta);
    response += `${i + 1}. ${alert.zone.name}: ${alert.type} at ${time}\n`;
  });
  response += '\n0. Back';
  
  return response;
}

async function handleVendorSearch(session, input) {
  if (input === '0') {
    session.step = 'MAIN_MENU';
    return getMainMenu(session);
  }
  
  // Search for vendors in zone
  const vendors = await searchVendors(input);
  session.data.vendors = vendors;
  session.data.vendorIndex = 0;
  
  if (vendors.length === 0) {
    return `CON No vendors found in "${input}".

Try another zone:`;
  }
  
  session.step = 'VENDOR_LIST';
  return formatVendorOption(vendors[0], 0);
}

function formatVendorOption(vendor, index) {
  return `CON ${index + 1}. ${vendor.businessName}
Distance: ${vendor.distance}m
Price: ${vendor.products[0]?.price} Le/${vendor.products[0]?.unit}
Rating: ${vendor.rating}/5

1. Order Now
2. Call Vendor
3. Next Vendor
0. Back`;
}

async function handleOrderQuantity(session, input) {
  if (input === '0') {
    session.step = 'VENDOR_LIST';
    const vendor = session.data.vendors[session.data.vendorIndex];
    return formatVendorOption(vendor, session.data.vendorIndex);
  }
  
  const quantity = parseInt(input);
  if (isNaN(quantity) || quantity < 1 || quantity > 50) {
    return `CON Invalid quantity. Enter 1-50:`;
  }
  
  const vendor = session.data.vendors[session.data.vendorIndex];
  const product = vendor.products[0];
  const total = quantity * product.price;
  
  session.data.quantity = quantity;
  session.data.total = total;
  session.step = 'ORDER_CONFIRM';
  
  return `CON Confirm Order:

${quantity}x ${product.name}
Total: ${total.toLocaleString()} Le
Delivery: ${vendor.deliveryFee.toLocaleString()} Le
TOTAL: ${(total + vendor.deliveryFee).toLocaleString()} Le

1. Confirm & Pay
0. Cancel`;
}

async function handlePaymentSelect(session, input) {
  const vendor = session.data.vendors[session.data.vendorIndex];
  const total = session.data.total + vendor.deliveryFee;
  
  let provider;
  switch (input) {
    case '1':
      provider = 'ORANGE_MONEY';
      break;
    case '2':
      provider = 'AFRICELL_MONEY';
      break;
    case '0':
      session.step = 'ORDER_CONFIRM';
      return `CON Order cancelled.

0. Back to menu`;
    default:
      return `CON Select payment:

1. Orange Money
2. Africell Money
0. Cancel`;
  }
  
  // Create order
  const order = await createOrder({
    customerId: session.user.id,
    vendorId: vendor.id,
    items: [{
      productId: vendor.products[0].id,
      quantity: session.data.quantity,
    }],
    deliveryAddress: session.user.primaryZone?.name || 'TBD',
  });
  
  // Initiate payment
  const payment = await initiatePayment(order, provider, session.user.phone);
  
  if (provider === 'ORANGE_MONEY') {
    return `END Order ${order.orderNumber} created!

Dial *144*4*6# to complete payment of ${total.toLocaleString()} Le.

Vendor will be notified once payment is received.`;
  } else {
    return `END Order ${order.orderNumber} created!

You will receive a prompt to approve payment of ${total.toLocaleString()} Le.

Vendor will be notified once payment is received.`;
  }
}

module.exports = router;
```

---

## 11. Maps & Geolocation

### 11.1 Map Features

```javascript
// React Native Map Component
import MapView, { Marker, Callout, Polygon } from 'react-native-maps';
import { useResources, useAlerts, useZones } from '../hooks';

const MajiMap = ({ initialRegion }) => {
  const { resources, loading: resourcesLoading } = useResources();
  const { alerts } = useAlerts();
  const { zones } = useZones();
  
  const [selectedResource, setSelectedResource] = useState(null);
  const [filters, setFilters] = useState({
    showWaterTaps: true,
    showVendors: true,
    showSolar: true,
    showBoreholes: true,
  });
  
  const getMarkerIcon = (type) => {
    const icons = {
      WATER_TAP: require('../assets/icons/water-tap.png'),
      BOREHOLE: require('../assets/icons/borehole.png'),
      WATER_VENDOR: require('../assets/icons/vendor.png'),
      SOLAR_CHARGER: require('../assets/icons/solar.png'),
      BATTERY_RENTAL: require('../assets/icons/battery.png'),
    };
    return icons[type];
  };
  
  const getMarkerColor = (status) => {
    return {
      ACTIVE: '#38A169',      // Green
      INACTIVE: '#E53E3E',    // Red
      UNDER_REPAIR: '#DD6B20', // Orange
      UNVERIFIED: '#718096',  // Gray
    }[status];
  };
  
  const filteredResources = resources.filter(r => {
    if (r.type === 'WATER_TAP' && !filters.showWaterTaps) return false;
    if (r.type === 'WATER_VENDOR' && !filters.showVendors) return false;
    if (r.type === 'SOLAR_CHARGER' && !filters.showSolar) return false;
    if (r.type === 'BOREHOLE' && !filters.showBoreholes) return false;
    return true;
  });
  
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        mapType="standard"
      >
        {/* Zone polygons */}
        {zones.map(zone => (
          <Polygon
            key={zone.id}
            coordinates={zone.geometry.coordinates[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            }))}
            strokeColor="rgba(10, 77, 104, 0.5)"
            fillColor="rgba(10, 77, 104, 0.1)"
            strokeWidth={1}
          />
        ))}
        
        {/* Resource markers */}
        {filteredResources.map(resource => (
          <Marker
            key={resource.id}
            coordinate={{
              latitude: resource.location.coordinates[1],
              longitude: resource.location.coordinates[0],
            }}
            image={getMarkerIcon(resource.type)}
            onPress={() => setSelectedResource(resource)}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{resource.name}</Text>
                <Text style={styles.calloutType}>{resource.type}</Text>
                <Text style={[
                  styles.calloutStatus,
                  { color: getMarkerColor(resource.status) }
                ]}>
                  {resource.status}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
        
        {/* Alert markers */}
        {alerts.map(alert => (
          <Marker
            key={alert.id}
            coordinate={{
              latitude: alert.zone.centroid.coordinates[1],
              longitude: alert.zone.centroid.coordinates[0],
            }}
            pinColor={alert.type === 'WATER_COMING' ? 'blue' : 'orange'}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{alert.zone.name}</Text>
                <Text>{alert.type}</Text>
                {alert.eta && (
                  <Text>ETA: {formatTime(alert.eta)}</Text>
                )}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      
      {/* Filter controls */}
      <FilterBar filters={filters} onChange={setFilters} />
      
      {/* Resource detail sheet */}
      {selectedResource && (
        <ResourceDetailSheet
          resource={selectedResource}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </View>
  );
};
```

### 11.2 Offline Maps

```javascript
// Offline map tile management
import MapboxGL from '@rnmapbox/maps';

// Configure offline packs for Freetown
const offlineManager = MapboxGL.offlineManager;

const FREETOWN_BOUNDS = {
  ne: [-13.15, 8.55],
  sw: [-13.35, 8.35],
};

async function downloadFreetownMap() {
  const progressListener = (offlinePack, status) => {
    console.log(`Download progress: ${status.percentage}%`);
  };
  
  const errorListener = (offlinePack, error) => {
    console.error('Download error:', error);
  };
  
  await offlineManager.createPack(
    {
      name: 'freetown-offline',
      styleURL: MapboxGL.StyleURL.Street,
      bounds: [FREETOWN_BOUNDS.sw, FREETOWN_BOUNDS.ne],
      minZoom: 10,
      maxZoom: 17,
    },
    progressListener,
    errorListener
  );
}

async function getOfflinePacks() {
  return await offlineManager.getPacks();
}

async function deleteOfflinePack(name) {
  await offlineManager.deletePack(name);
}
```

---

## 12. Notifications System

### 12.1 Notification Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Event Triggers:                                                │
│  ├── Water Alert Created                                        │
│  ├── Order Status Changed                                       │
│  ├── Payment Received                                           │
│  ├── Report Status Updated                                      │
│  ├── Bounty Earned                                              │
│  └── System Announcements                                       │
│                                                                  │
│                         │                                        │
│                         ▼                                        │
│  ┌─────────────────────────────────────────┐                    │
│  │         NOTIFICATION SERVICE            │                    │
│  │                                         │                    │
│  │  1. Determine recipients                │                    │
│  │  2. Check user preferences              │                    │
│  │  3. Select channels (push/SMS/in-app)   │                    │
│  │  4. Format message per channel          │                    │
│  │  5. Queue for delivery                  │                    │
│  └─────────────────────────────────────────┘                    │
│                         │                                        │
│           ┌─────────────┼─────────────┐                         │
│           ▼             ▼             ▼                         │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│     │   Push   │  │   SMS    │  │  In-App  │                   │
│     │   (FCM)  │  │  (AT)    │  │ (WebSock)│                   │
│     └──────────┘  └──────────┘  └──────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 Notification Service Implementation

```javascript
// services/notificationService.js
import { prisma } from '../db';
import { fcmService } from './fcmService';
import { smsService } from './smsService';
import { socketService } from './socketService';
import { notificationQueue } from '../queues';

class NotificationService {
  
  // Send water alert to zone users
  async sendWaterAlert(alert) {
    // Get users in the zone
    const users = await prisma.user.findMany({
      where: {
        primaryZoneId: alert.zoneId,
        isActive: true,
      },
      select: {
        id: true,
        phone: true,
        language: true,
        notificationPrefs: true,
      },
    });
    
    // Queue notifications for each user
    for (const user of users) {
      await notificationQueue.add('send', {
        userId: user.id,
        type: 'ALERT',
        title: this.translate('water_alert_title', user.language),
        body: this.formatAlertMessage(alert, user.language),
        data: {
          alertId: alert.id,
          zoneId: alert.zoneId,
          type: alert.type,
        },
        channels: this.getChannels(user, 'alerts'),
      });
    }
  }
  
  // Send order update to customer
  async sendOrderUpdate(order, newStatus) {
    const user = await prisma.user.findUnique({
      where: { id: order.customerId },
    });
    
    await this.send({
      userId: user.id,
      type: 'ORDER_UPDATE',
      title: this.translate('order_update_title', user.language),
      body: this.formatOrderMessage(order, newStatus, user.language),
      data: {
        orderId: order.id,
        status: newStatus,
      },
      channels: this.getChannels(user, 'orders'),
    });
  }
  
  // Send bounty notification
  async sendBountyEarned(report, amount) {
    const user = await prisma.user.findUnique({
      where: { id: report.userId },
    });
    
    await this.send({
      userId: user.id,
      type: 'BOUNTY',
      title: this.translate('bounty_earned_title', user.language),
      body: this.formatBountyMessage(amount, user.language),
      data: {
        reportId: report.id,
        amount: amount,
      },
      channels: ['PUSH', 'SMS', 'IN_APP'], // All channels for bounty
    });
  }
  
  // Core send method
  async send({ userId, type, title, body, data, channels }) {
    // Store in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data,
        channel: 'IN_APP',
      },
    });
    
    // Send via WebSocket for real-time
    if (channels.includes('IN_APP')) {
      socketService.sendToUser(userId, 'notification', {
        id: notification.id,
        type,
        title,
        body,
        data,
      });
    }
    
    // Send push notification
    if (channels.includes('PUSH')) {
      await fcmService.send(userId, { title, body, data });
    }
    
    // Send SMS
    if (channels.includes('SMS')) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      await smsService.send(user.phone, body);
    }
    
    return notification;
  }
  
  // Get channels based on user preferences
  getChannels(user, category) {
    const defaults = {
      alerts: ['PUSH', 'IN_APP'],
      orders: ['PUSH', 'SMS', 'IN_APP'],
      reports: ['PUSH', 'IN_APP'],
      system: ['IN_APP'],
    };
    
    // Check user preferences
    const prefs = user.notificationPrefs?.[category];
    if (prefs) {
      return prefs.enabled ? prefs.channels : [];
    }
    
    return defaults[category] || ['IN_APP'];
  }
  
  // Message formatting
  formatAlertMessage(alert, language) {
    const templates = {
      EN: {
        WATER_COMING: `Water supply expected in ${alert.zone.name} at ${formatTime(alert.eta)}. Duration: ~${alert.duration} min.`,
        WATER_ACTIVE: `Water is now flowing in ${alert.zone.name}!`,
        WATER_ENDED: `Water supply ended in ${alert.zone.name}.`,
        FLOOD_WARNING: `⚠️ Flood warning for ${alert.zone.name}. Stay safe!`,
      },
      KRI: {
        WATER_COMING: `Wata de kam na ${alert.zone.name} na ${formatTime(alert.eta)}. E go las layk ${alert.duration} minit.`,
        WATER_ACTIVE: `Wata de ron na ${alert.zone.name}!`,
        WATER_ENDED: `Wata don stop na ${alert.zone.name}.`,
        FLOOD_WARNING: `⚠️ Flod warnin fo ${alert.zone.name}. Tek kia!`,
      },
    };
    
    return templates[language]?.[alert.type] || templates.EN[alert.type];
  }
  
  translate(key, language) {
    const translations = {
      water_alert_title: { EN: 'Water Alert', KRI: 'Wata Alert' },
      order_update_title: { EN: 'Order Update', KRI: 'Oda Update' },
      bounty_earned_title: { EN: 'Bounty Earned!', KRI: 'Yu Don Earn Moni!' },
    };
    
    return translations[key]?.[language] || translations[key]?.EN || key;
  }
}

export const notificationService = new NotificationService();
```

---

## 13. Analytics & Data Pipeline

### 13.1 Event Tracking

```javascript
// analytics/events.js

// Event types to track
const EVENTS = {
  // User events
  USER_REGISTERED: 'user_registered',
  USER_LOGIN: 'user_login',
  PROFILE_UPDATED: 'profile_updated',
  
  // Alert events
  ALERT_CREATED: 'alert_created',
  ALERT_VIEWED: 'alert_viewed',
  ALERT_FEEDBACK: 'alert_feedback',
  
  // Order events
  ORDER_STARTED: 'order_started',
  ORDER_CREATED: 'order_created',
  ORDER_PAID: 'order_paid',
  ORDER_COMPLETED: 'order_completed',
  ORDER_CANCELLED: 'order_cancelled',
  
  // Vendor events
  VENDOR_VIEWED: 'vendor_viewed',
  VENDOR_CALLED: 'vendor_called',
  VENDOR_SEARCH: 'vendor_search',
  
  // Map events
  MAP_VIEWED: 'map_viewed',
  RESOURCE_VIEWED: 'resource_viewed',
  RESOURCE_ADDED: 'resource_added',
  
  // Report events
  REPORT_CREATED: 'report_created',
  REPORT_VERIFIED: 'report_verified',
  BOUNTY_PAID: 'bounty_paid',
  
  // Engagement events
  APP_OPENED: 'app_opened',
  NOTIFICATION_RECEIVED: 'notification_received',
  NOTIFICATION_CLICKED: 'notification_clicked',
};

// Analytics service
class AnalyticsService {
  async track(event, properties = {}, userId = null) {
    const eventData = {
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        platform: this.getPlatform(),
        appVersion: this.getAppVersion(),
      },
      userId,
      anonymousId: userId ? null : this.getAnonymousId(),
    };
    
    // Store in database
    await prisma.analyticsEvent.create({
      data: eventData,
    });
    
    // Send to external analytics (optional)
    if (process.env.MIXPANEL_TOKEN) {
      await this.sendToMixpanel(eventData);
    }
  }
  
  // Track page/screen views
  async trackScreen(screenName, userId) {
    await this.track('screen_viewed', { screen: screenName }, userId);
  }
  
  // Track errors
  async trackError(error, context = {}) {
    await this.track('error_occurred', {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }
}

export const analytics = new AnalyticsService();
```

### 13.2 Data Export for B2B

```javascript
// Data licensing API for partners

// GET /api/v1/data/water-availability
// Requires: API key + data license agreement

router.get('/data/water-availability', authenticate, authorize('data_partner'), async (req, res) => {
  const { zoneId, startDate, endDate, granularity = 'daily' } = req.query;
  
  // Aggregate water availability data
  const data = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC(${granularity}, created_at) as period,
      zone_id,
      COUNT(*) FILTER (WHERE type = 'WATER_COMING') as supply_events,
      AVG(duration) as avg_duration_minutes,
      AVG(confidence) as avg_confidence,
      COUNT(DISTINCT scout_id) as active_scouts
    FROM alerts
    WHERE zone_id = ${zoneId}
      AND created_at BETWEEN ${startDate} AND ${endDate}
      AND status = 'VERIFIED'
    GROUP BY 1, 2
    ORDER BY 1
  `;
  
  // Add computed metrics
  const enrichedData = data.map(row => ({
    ...row,
    reliability_score: calculateReliability(row),
    coverage_index: calculateCoverage(row),
  }));
  
  res.json({
    meta: {
      zone: await getZoneName(zoneId),
      period: { start: startDate, end: endDate },
      granularity,
      generated_at: new Date().toISOString(),
    },
    data: enrichedData,
  });
});

// GET /api/v1/data/demand-patterns
router.get('/data/demand-patterns', authenticate, authorize('data_partner'), async (req, res) => {
  const { zoneIds, startDate, endDate } = req.query;
  
  const data = await prisma.$queryRaw`
    SELECT 
      zone_id,
      EXTRACT(DOW FROM created_at) as day_of_week,
      EXTRACT(HOUR FROM created_at) as hour_of_day,
      COUNT(*) as order_count,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as avg_order_value,
      COUNT(DISTINCT customer_id) as unique_customers
    FROM orders
    WHERE zone_id = ANY(${zoneIds})
      AND created_at BETWEEN ${startDate} AND ${endDate}
      AND status = 'COMPLETED'
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3
  `;
  
  res.json({
    meta: {
      zones: zoneIds,
      period: { start: startDate, end: endDate },
      generated_at: new Date().toISOString(),
    },
    data,
  });
});
```

---

## 14. DevOps & Deployment

### 14.1 Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf

provider "aws" {
  region = "eu-west-1"  # Closest to West Africa
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "maji-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["eu-west-1a", "eu-west-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  
  enable_nat_gateway = true
  single_nat_gateway = true  # Cost optimization for MVP
}

# ECS Cluster
resource "aws_ecs_cluster" "maji" {
  name = "maji-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "maji" {
  identifier        = "maji-db"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.t3.micro"  # MVP size
  allocated_storage = 20
  
  db_name  = "maji"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.maji.name
  
  backup_retention_period = 7
  skip_final_snapshot     = false
  
  tags = {
    Environment = "production"
    Project     = "maji"
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "maji" {
  cluster_id           = "maji-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  
  security_group_ids = [aws_security_group.redis.id]
  subnet_group_name  = aws_elasticache_subnet_group.maji.name
}

# S3 for media storage
resource "aws_s3_bucket" "media" {
  bucket = "maji-media-${var.environment}"
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://maji.app", "https://*.maji.app"]
    max_age_seconds = 3600
  }
}
```

### 14.2 Docker Configuration

```dockerfile
# Dockerfile (Backend)
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml (Local Development)
version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://maji:maji@db:5432/maji
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules
  
  db:
    image: postgis/postgis:15-3.3
    environment:
      - POSTGRES_USER=maji
      - POSTGRES_PASSWORD=maji
      - POSTGRES_DB=maji
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  adminer:
    image: adminer
    ports:
      - "8080:8080"

volumes:
  postgres_data:
```

### 14.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
      
      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build and push
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/maji-api:$IMAGE_TAG .
          docker push $ECR_REGISTRY/maji-api:$IMAGE_TAG
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: task-definition.json
          service: maji-api
          cluster: maji-cluster
          wait-for-service-stability: true
```

---

## 15. MVP Scope & Phasing

### 15.1 MVP Features (Phase 1 - 3 months)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MVP FEATURE SET                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MUST HAVE (P0):                                                │
│  ├── Phone + OTP authentication                                 │
│  ├── Zone selection                                             │
│  ├── View water alerts in my zone                               │
│  ├── Receive push notifications for alerts                      │
│  ├── View vendor list                                           │
│  ├── Place order (simple flow)                                  │
│  ├── Orange Money payment                                       │
│  └── Basic offline support (cached data)                        │
│                                                                  │
│  SHOULD HAVE (P1):                                              │
│  ├── Post alerts (Scout role)                                   │
│  ├── Resource map (water points only)                           │
│  ├── Report leaks                                               │
│  ├── Order history                                              │
│  ├── Vendor ratings                                             │
│  └── USSD basic menu                                            │
│                                                                  │
│  NICE TO HAVE (P2):                                             │
│  ├── Africell Money payment                                     │
│  ├── Solar/battery on map                                       │
│  ├── Bulk tanker ordering                                       │
│  ├── Krio language                                              │
│  └── Alert feedback system                                      │
│                                                                  │
│  DEFERRED (Phase 2+):                                           │
│  ├── B2B premium tier                                           │
│  ├── Data licensing API                                         │
│  ├── Full offline sync                                          │
│  ├── Vendor dashboard app                                       │
│  └── Admin web portal                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 15.2 Development Timeline

```
Week 1-2: Project Setup
├── Repository setup, CI/CD
├── Database schema, migrations
├── Basic API structure
└── React Native project setup

Week 3-4: Authentication & Users
├── Phone + OTP auth flow
├── User profile management
├── Zone selection
└── Push notification setup

Week 5-6: Alerts System
├── Alert creation API
├── Alert viewing (list, map)
├── Push notifications for alerts
└── Scout role & permissions

Week 7-8: Vendor Marketplace
├── Vendor listing
├── Product management
├── Basic search & filters
└── Vendor detail view

Week 9-10: Orders & Payments
├── Order creation flow
├── Orange Money integration
├── Order status updates
├── Order history

Week 11-12: Polish & Launch
├── Bug fixes
├── Performance optimization
├── Beta testing
├── App store submission
```

### 15.3 Technical Debt Log

Track technical decisions that need revisiting:

| Item | Current State | Target State | Priority |
|------|---------------|--------------|----------|
| Session storage | In-memory Map | Redis | High |
| Image uploads | Direct to S3 | Cloudinary with optimization | Medium |
| Search | PostgreSQL LIKE | Elasticsearch | Medium |
| Rate limiting | express-rate-limit | Kong/API Gateway | Low |
| Monitoring | Console logs | Grafana + Prometheus | High |
| Testing | Manual | 80% coverage | Medium |

---

## Appendix A: Environment Variables

```bash
# .env.example

# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/maji

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=30d

# Mobile Money
ORANGE_CLIENT_ID=
ORANGE_CLIENT_SECRET=
ORANGE_MERCHANT_CODE=
AFRICELL_API_KEY=
AFRICELL_MERCHANT_ID=

# SMS & USSD (Africa's Talking)
AT_API_KEY=
AT_USERNAME=
AT_SENDER_ID=MAJI

# Push Notifications (Firebase)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Maps
MAPBOX_ACCESS_TOKEN=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=eu-west-1

# Or Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Analytics (optional)
MIXPANEL_TOKEN=
SENTRY_DSN=
```

---

## Appendix B: API Error Codes

```javascript
const ERROR_CODES = {
  // Authentication (1xxx)
  AUTH_INVALID_PHONE: { code: 1001, message: 'Invalid phone number format' },
  AUTH_OTP_EXPIRED: { code: 1002, message: 'OTP has expired' },
  AUTH_OTP_INVALID: { code: 1003, message: 'Invalid OTP' },
  AUTH_TOKEN_EXPIRED: { code: 1004, message: 'Token has expired' },
  AUTH_TOKEN_INVALID: { code: 1005, message: 'Invalid token' },
  AUTH_UNAUTHORIZED: { code: 1006, message: 'Unauthorized' },
  
  // Users (2xxx)
  USER_NOT_FOUND: { code: 2001, message: 'User not found' },
  USER_ALREADY_EXISTS: { code: 2002, message: 'User already exists' },
  USER_INVALID_ROLE: { code: 2003, message: 'Invalid user role' },
  
  // Vendors (3xxx)
  VENDOR_NOT_FOUND: { code: 3001, message: 'Vendor not found' },
  VENDOR_NOT_VERIFIED: { code: 3002, message: 'Vendor not verified' },
  VENDOR_CLOSED: { code: 3003, message: 'Vendor is currently closed' },
  
  // Orders (4xxx)
  ORDER_NOT_FOUND: { code: 4001, message: 'Order not found' },
  ORDER_INVALID_STATUS: { code: 4002, message: 'Invalid order status transition' },
  ORDER_ALREADY_PAID: { code: 4003, message: 'Order already paid' },
  ORDER_MIN_NOT_MET: { code: 4004, message: 'Minimum order amount not met' },
  
  // Payments (5xxx)
  PAYMENT_FAILED: { code: 5001, message: 'Payment failed' },
  PAYMENT_PENDING: { code: 5002, message: 'Payment pending approval' },
  PAYMENT_INVALID_PROVIDER: { code: 5003, message: 'Invalid payment provider' },
  
  // Alerts (6xxx)
  ALERT_NOT_FOUND: { code: 6001, message: 'Alert not found' },
  ALERT_SCOUT_REQUIRED: { code: 6002, message: 'Scout role required' },
  ALERT_ZONE_REQUIRED: { code: 6003, message: 'Zone is required' },
  
  // Reports (7xxx)
  REPORT_NOT_FOUND: { code: 7001, message: 'Report not found' },
  REPORT_DUPLICATE: { code: 7002, message: 'Duplicate report detected' },
  
  // General (9xxx)
  VALIDATION_ERROR: { code: 9001, message: 'Validation error' },
  RATE_LIMIT_EXCEEDED: { code: 9002, message: 'Rate limit exceeded' },
  INTERNAL_ERROR: { code: 9999, message: 'Internal server error' },
};
```

---

**Document End**

*This specification is a living document and will be updated as the project evolves.*
