# SureShot Backend — Design Spec

**Date:** 2026-06-08  
**Stack:** NestJS · Prisma · PostgreSQL · Docker · Nginx  
**Scope:** Backend only (REST API consumed by Next.js frontend)

---

## 1. Context

World Cup prediction app. Users join private rooms, predict match scores, earn points based on accuracy. Admin manages matches and loads results. No real money involved.

---

## 2. Architecture

**Monolith modular.** Single NestJS process with clearly bounded modules. One Docker image scaled horizontally behind Nginx (round-robin). Covers all lab deliverables without microservices complexity.

### Modules

| Module | Responsibility |
|---|---|
| `AuthModule` | Email/password + Google OAuth, JWT access/refresh tokens |
| `UsersModule` | User profile, role management |
| `RoomsModule` | Room CRUD, invite codes, membership |
| `MatchesModule` | Match CRUD (admin), result entry, status transitions |
| `PredictionsModule` | Submit/edit predictions with timing rules |
| `ScoringModule` | Scoring engine (5 rules), streak computation |
| `LeaderboardModule` | Aggregated ranking per room |

---

## 3. Data Model (Prisma)

```prisma
enum Role         { USER ADMIN }
enum MatchStatus  { SCHEDULED IN_PROGRESS FINISHED }
enum MatchStage   { GROUP ROUND_OF_16 QUARTER_FINAL SEMI_FINAL FINAL }

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  avatar        String?
  password      String?  // null for OAuth users
  googleId      String?  // null for email/password users
  role          Role     @default(USER)
  refreshToken  String?  // stored hashed (bcrypt)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  ownedRooms    Room[]
  memberships   RoomMember[]
  predictions   Prediction[]
}

model Room {
  id          String   @id @default(uuid())
  name        String
  inviteCode  String   @unique  // nanoid 8 chars
  ownerId     String
  createdAt   DateTime @default(now())

  owner       User         @relation(fields: [ownerId], references: [id])
  members     RoomMember[]
  predictions Prediction[]
}

model RoomMember {
  id       String   @id @default(uuid())
  roomId   String
  userId   String
  joinedAt DateTime @default(now())

  room     Room @relation(fields: [roomId], references: [id])
  user     User @relation(fields: [userId], references: [id])

  @@unique([roomId, userId])
}

model Match {
  id            String      @id @default(uuid())
  homeTeam      String
  awayTeam      String
  matchDatetime DateTime
  homeScore     Int?        // null until result loaded
  awayScore     Int?        // null until result loaded
  status        MatchStatus @default(SCHEDULED)
  stage         MatchStage
  group         String?     // e.g. "A", "B" — only for GROUP stage

  predictions   Prediction[]
}

model Prediction {
  id           String   @id @default(uuid())
  userId       String
  matchId      String
  roomId       String
  homeScore    Int
  awayScore    Int
  isEarlyBonus Boolean  @default(false)  // computed at submit: >24h before match
  submittedAt  DateTime @default(now())

  user         User  @relation(fields: [userId], references: [id])
  match        Match @relation(fields: [matchId], references: [id])
  room         Room  @relation(fields: [roomId], references: [id])

  @@unique([userId, matchId, roomId])
}
```

> Scores are computed on-the-fly from `Prediction` + `Match` results. No separate `Score` table — sufficient for HTTP polling leaderboard.

---

## 4. Auth Strategy

### Dual auth: email/password OR Google OAuth

**Email/password flow:**
1. `POST /api/v1/auth/register` — hash password with bcrypt (rounds: 12)
2. `POST /api/v1/auth/login` — verify password → issue tokens

**Google OAuth flow:**
1. `GET /api/v1/auth/google` — redirect to Google
2. `GET /api/v1/auth/google/callback` — exchange code → find or create user → issue tokens

**JWT tokens:**
- Access token: 15 min, returned in response body
- Refresh token: 7 days, stored in `HttpOnly; Secure; SameSite=Strict` cookie
- Refresh token stored **hashed** (bcrypt) in `User.refreshToken`

**Token rotation:**
- `POST /api/v1/auth/refresh` — validates cookie, verifies hash, issues new access token + rotates refresh token
- `DELETE /api/v1/auth/logout` — clears `User.refreshToken` from DB + clears cookie

---

## 5. API Endpoints

Base path: `/api/v1/`  
Auth: `Authorization: Bearer <access_token>` (except auth endpoints)

### Auth
```
POST   /auth/register          → 201  { accessToken, user }
POST   /auth/login             → 200  { accessToken, user }
GET    /auth/google            → 302  redirect
GET    /auth/google/callback   → 200  { accessToken, user }
POST   /auth/refresh           → 200  { accessToken }
DELETE /auth/logout            → 204
```

### Users
```
GET    /users/me               → 200  user profile
PATCH  /users/me               → 200  update name/avatar (role excluded)
```

### Rooms
```
POST   /rooms                           → 201  create room
GET    /rooms                           → 200  own rooms (paginated)
GET    /rooms/:id                       → 200  room detail
DELETE /rooms/:id                       → 204  owner only
POST   /rooms/join                      → 200  join by invite code { inviteCode }
GET    /rooms/:id/members               → 200  member list
DELETE /rooms/:id/members/:userId       → 204  kick member (owner only)
POST   /rooms/:id/invites               → 201  generate/rotate invite code
```

### Matches
```
GET    /matches                → 200  list (?status=FINISHED&stage=GROUP, paginated)
GET    /matches/:id            → 200  match detail
POST   /matches                → 201  create (ADMIN)
PATCH  /matches/:id            → 200  update / load result (ADMIN)
DELETE /matches/:id            → 204  delete (ADMIN)
```

### Predictions
```
POST   /rooms/:roomId/predictions              → 201  submit prediction
GET    /rooms/:roomId/predictions              → 200  own predictions in room
GET    /rooms/:roomId/predictions/:matchId     → 200  specific prediction
PATCH  /rooms/:roomId/predictions/:matchId     → 200  update (blocked < 10 min before)
```

### Leaderboard
```
GET    /rooms/:roomId/leaderboard              → 200  sorted ranking (paginated)
```

### Error response format (all errors)
```json
{
  "error": {
    "code": "PREDICTION_LOCKED",
    "message": "Cannot edit a prediction less than 10 minutes before the match.",
    "details": []
  }
}
```

---

## 6. Scoring Engine

Triggered by `EventEmitter2` when admin sets a match to `FINISHED`.

### Per-prediction base points (computed for each prediction of the finished match)

```
points = 0

if prediction.homeScore === match.homeScore AND prediction.awayScore === match.awayScore:
  points = 5   // exact result
else:
  predDiff  = prediction.homeScore - prediction.awayScore
  matchDiff = match.homeScore - match.awayScore
  predWinner  = sign(predDiff)   // -1 | 0 | 1
  matchWinner = sign(matchDiff)

  if predWinner === matchWinner:
    points += 3   // correct winner / draw
  if predDiff === matchDiff:
    points += 2   // correct goal difference (implies same winner)

if prediction.isEarlyBonus:
  points += 1   // prediction submitted > 24h before match
```

### Streak bonus (computed per user per room on leaderboard request)

Streak is evaluated across the user's **full prediction history** in the room, ordered by `match.matchDatetime` (FINISHED matches only):

```
streak = 0
streakBonus = 0
for each prediction (ordered by matchDatetime ASC):
  if points_for_prediction >= 3:   // correct winner or exact
    streak += 1
    if streak % 3 === 0:
      streakBonus += 2
  else:
    streak = 0                     // broken streak resets to 0
```

> Streak bonus is computed lazily on `GET /rooms/:roomId/leaderboard`, not stored. World Cup = max 64 matches → on-the-fly computation is fast enough.

### Leaderboard aggregation

```
totalPoints = sum(basePoints per prediction) + streakBonus + earlyBonuses
```

**Prediction timing rules (enforced at submit/update):**
- `isEarlyBonus = submittedAt < match.matchDatetime - 24h`
- Update blocked if `now > match.matchDatetime - 10min`
- Submit blocked if match status is `FINISHED`

---

## 7. Sprint Plan

| Sprint | Focus | Key Deliverable |
|---|---|---|
| 0 | Project base | NestJS + Prisma + Docker Compose + Swagger live |
| 1 | Auth + Users | Register/login/OAuth/JWT/refresh/profile edit |
| 2 | Rooms | CRUD + invite codes + membership |
| 3 | Matches | Admin CRUD + result entry + EventEmitter trigger |
| 4 | Predictions | Submit/edit with timing validation + isEarlyBonus |
| 5 | Scoring + Leaderboard | Scoring engine + streak + leaderboard endpoint |
| 6 | Docker + QA | Multi-stage Dockerfile + Nginx LB + stress test |

---

## 8. Non-Functional Requirements

- **Rate limiting:** `@nestjs/throttler` — 100 req/min per IP
- **Validation:** `class-validator` + `class-transformer` on all DTOs
- **Docs:** Swagger at `/api/docs` (auto-generated via `@nestjs/swagger`)
- **Horizontal scaling:** single container image → `docker compose up --scale app=N` + Nginx round-robin
- **Stress testing:** k6 or Artillery, 100 concurrent users, document RPS and P95 latency
- **HTTPS:** handled at Nginx layer (for production/lab deployment)

---

## 9. Out of Scope

- AI statistics / predictive analytics
- Real-time WebSockets (polling via `GET /leaderboard`)
- Payment / real money
- Frontend implementation
