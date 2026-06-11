# WebSocket Real-Time Design

**Date:** 2026-06-11  
**Scope:** Admin/matches pages, room predictions/leaderboard/members tabs, home stats cards

---

## Problem

All data is fetched via REST with staleTime polling. When an admin updates a match result, other users see stale data until their next refetch. Leaderboard, predictions, and member lists require manual refresh.

## Solution

Socket.io gateway on the backend broadcasts events when data changes. Frontend hooks subscribe and call `invalidateQueries` to trigger an immediate refetch — no data travels over the socket itself.

---

## Architecture

### Transport

Socket.io attached to the existing NestJS HTTP server on port 3000. Same origin, no separate port. CORS configured to allow `FRONTEND_URL`.

### Event Flow

```
REST mutation → Service → EventEmitter.emit(internal) → NotificationsGateway → socket.server.emit(ws) → frontend hooks → invalidateQueries → TanStack Query refetch
```

### Internal Events (EventEmitter) → WS Events

| Internal event | WS event | Payload | Trigger |
|---|---|---|---|
| `match.updated` | `match:updated` | `{ matchId: string }` | Any PATCH /matches/:id |
| `match.finished` (existing) | `leaderboard:updated` | `{ matchId: string }` | Match status → FINISHED with scores |
| `prediction.saved` | `prediction:saved` | `{ roomId: string }` | Prediction created or updated |
| `room.member.updated` | `member:updated` | `{ roomId: string }` | Member joins or is kicked |

All events are broadcast to all connected clients (`server.emit`). No server-side socket rooms. Frontend hooks filter by roomId where relevant.

---

## Backend Changes

### New files

**`src/notifications/notifications.gateway.ts`**  
`@WebSocketGateway` with CORS. Injects nothing. Uses `@OnEvent` from `@nestjs/event-emitter` to listen to the 4 internal events above and calls `this.server.emit(wsEvent, payload)` for each.

**`src/notifications/notifications.module.ts`**  
Standard NestJS module wrapping the gateway. Exported so AppModule can register it.

### Modified files

**`src/matches/matches.service.ts`**  
Inject `EventEmitter2`. In `update()`, after the Prisma update, emit `match.updated` with `{ matchId: id }`. The existing `match.finished` emit stays as-is and the gateway will also listen to it for `leaderboard:updated`.

**`src/predictions/predictions.service.ts`**  
Inject `EventEmitter2`. After create or update, emit `prediction.saved` with `{ roomId }`.

**`src/rooms/rooms.service.ts`**  
Inject `EventEmitter2`. After `join()` and `kickMember()`, emit `room.member.updated` with `{ roomId }`.

**`src/app.module.ts`**  
Add `NotificationsModule` to imports array.

**`src/main.ts`**  
Add `IoAdapter` with explicit CORS options so the WS handshake respects `FRONTEND_URL`. Without this, the Socket.io handshake rejects cross-origin connections even if HTTP CORS is configured.

### Dependencies to install (Backend)

```
@nestjs/websockets  @nestjs/platform-socket.io  socket.io
```

---

## Frontend Changes

### New file

**`lib/socket.ts`**  
Singleton `io()` connection. Lazily initialized on first call. Connects to `NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000'`. Exported as `getSocket()` function so SSR never instantiates it.

### Modified hooks

Each hook adds a `useEffect` that:
1. Calls `getSocket()` to get the singleton
2. Registers an `on(event, handler)` listener where handler calls `qc.invalidateQueries()`
3. Returns cleanup `socket.off(event, handler)`

| Hook | WS event | invalidateQueries key |
|---|---|---|
| `useMatches` | `match:updated` | `['matches']` |
| `useMatch(id)` | `match:updated` (filter by matchId) | `['matches', id]` |
| `useLeaderboard(roomId)` | `leaderboard:updated` | `['rooms', roomId, 'leaderboard']` |
| `usePredictions(roomId)` | `prediction:saved` (filter by roomId) | `['rooms', roomId, 'predictions']` |
| `useRoomMembers(roomId)` | `member:updated` (filter by roomId) | `['rooms', roomId, 'members']` |

### Modified pages

**`app/(app)/page.tsx` (Home)**  
Adds a `useEffect` subscribing to `leaderboard:updated`. Invalidates all `['rooms', *, 'leaderboard', 'home']` queries so the 3 stat cards (totalPoints, predictionsCount, streakBonus) update.

### Dependencies to install (Frontend)

```
socket.io-client
```

---

## Data Flow per Use Case

**Admin updates match score:**  
`PATCH /matches/:id` → `MatchesService.update()` → emits `match.updated` + `match.finished` (if FINISHED) → gateway broadcasts both → all `useMatches` hooks refetch → all `useLeaderboard` hooks refetch

**User joins room:**  
`POST /rooms/:id/join` → `RoomsService.join()` → emits `room.member.updated` → gateway broadcasts → all `useRoomMembers(roomId)` hooks refetch

**User saves prediction:**  
`POST /rooms/:id/predictions` → `PredictionsService.create()` → emits `prediction.saved` → gateway broadcasts → all `usePredictions(roomId)` hooks for that room refetch

---

## Error Handling

- Socket disconnects: Socket.io auto-reconnects. During reconnect gap, TanStack Query staleTime still covers short outages.
- WS event received during page transition: `invalidateQueries` is safe to call even if the query is not mounted — it simply marks stale for next mount.
- Backend gateway throws: isolated from HTTP path, no impact on REST endpoints.

---

## Out of Scope

- Authentication on the WS connection (no JWT on handshake — data is non-sensitive, all REST endpoints still enforce auth)
- Server-side socket rooms (not needed at this scale)
- Optimistic WS updates (TanStack Query handles this where already implemented)
- Admin `member:updated` events on other rooms (filtered by roomId client-side)
