# WebSocket Real-Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Socket.io real-time push so match updates, leaderboard changes, predictions, and member list changes are reflected instantly across admin, matches, room, and home pages without manual refresh.

**Architecture:** Single `NotificationsGateway` on the NestJS HTTP port (3000) listens to internal `EventEmitter2` events and broadcasts Socket.io events to all connected clients. Frontend hooks subscribe to those events and call `queryClient.invalidateQueries` — data travels only over existing REST endpoints, WebSocket only carries cache-invalidation signals.

**Tech Stack:** `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` (backend); `socket.io-client` (frontend); TanStack Query v5 (already in use).

---

## File Map

### Backend — new files
- `Backend/src/notifications/notifications.gateway.ts` — WS gateway, listens to internal events, broadcasts to all clients
- `Backend/src/notifications/notifications.module.ts` — NestJS module wrapping the gateway

### Backend — modified files
- `Backend/src/main.ts` — add `IoAdapter` with explicit CORS so WS handshake is not rejected
- `Backend/src/app.module.ts` — register `NotificationsModule`
- `Backend/src/matches/matches.service.ts` — inject `EventEmitter2`, emit `match.updated` after every `update()` call
- `Backend/src/predictions/predictions.service.ts` — inject `EventEmitter2`, emit `prediction.saved` after `create()` and `update()`
- `Backend/src/rooms/rooms.service.ts` — inject `EventEmitter2`, emit `room.member.updated` after `join()` and `kickMember()`

### Frontend — new files
- `Frontend/lib/socket.ts` — lazy singleton `io()` connection; only runs client-side

### Frontend — modified files
- `Frontend/hooks/useMatches.ts` — subscribe to `match:updated`, invalidate `['matches']`
- `Frontend/hooks/useLeaderboard.ts` — subscribe to `leaderboard:updated`, invalidate own room's leaderboard key
- `Frontend/hooks/usePredictions.ts` — subscribe to `prediction:saved` filtered by `roomId`, invalidate predictions key
- `Frontend/hooks/useRoomMembers.ts` — subscribe to `member:updated` filtered by `roomId`, invalidate members key
- `Frontend/app/(app)/page.tsx` — subscribe to `leaderboard:updated`, invalidate all home leaderboard queries

---

## Task 1: Install backend WS packages

**Files:**
- Modify: `Backend/package.json` (via npm)

- [ ] **Step 1: Install packages**

```bash
cd Backend && npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

Expected: packages appear in `node_modules` with no peer-dep errors.

- [ ] **Step 2: Verify TypeScript types resolve**

```bash
cd Backend && npx tsc --noEmit
```

Expected: no new errors (baseline — may already have 0 errors).

---

## Task 2: Create NotificationsGateway

**Files:**
- Create: `Backend/src/notifications/notifications.gateway.ts`

- [ ] **Step 1: Create the gateway file**

```typescript
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  @OnEvent('match.updated')
  handleMatchUpdated(payload: { matchId: string }) {
    this.server.emit('match:updated', payload);
  }

  @OnEvent('match.finished')
  handleMatchFinished(payload: { matchId: string }) {
    this.server.emit('leaderboard:updated', payload);
  }

  @OnEvent('prediction.saved')
  handlePredictionSaved(payload: { roomId: string }) {
    this.server.emit('prediction:saved', payload);
  }

  @OnEvent('room.member.updated')
  handleMemberUpdated(payload: { roomId: string }) {
    this.server.emit('member:updated', payload);
  }
}
```

- [ ] **Step 2: Create the module file**

`Backend/src/notifications/notifications.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  providers: [NotificationsGateway],
})
export class NotificationsModule {}
```

- [ ] **Step 3: Register in AppModule**

Open `Backend/src/app.module.ts`. Add the import and add `NotificationsModule` to the `imports` array:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { MatchesModule } from './matches/matches.module';
import { PredictionsModule } from './predictions/predictions.module';
import { ScoringModule } from './scoring/scoring.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    MatchesModule,
    PredictionsModule,
    ScoringModule,
    LeaderboardModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 4: Configure IoAdapter with CORS in main.ts**

Open `Backend/src/main.ts`. Add the adapter before `app.listen`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

class CorsIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
        credentials: true,
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableShutdownHooks();
  app.useWebSocketAdapter(new CorsIoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SureShot API')
      .setDescription('World Cup prediction app REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 5: Build to verify no TypeScript errors**

```bash
cd Backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Start backend and verify WS endpoint responds**

```bash
cd Backend && npm run start:dev &
sleep 4
curl -s http://localhost:3000/socket.io/?EIO=4&transport=polling | head -c 50
```

Expected: response starts with `0{` (Socket.io handshake JSON).

- [ ] **Step 7: Commit**

```bash
cd Backend
git add src/notifications/ src/app.module.ts src/main.ts
git commit -m "feat(backend): add NotificationsGateway with Socket.io"
```

---

## Task 3: Emit `match.updated` from MatchesService

**Files:**
- Modify: `Backend/src/matches/matches.service.ts`

`MatchesService` already injects `EventEmitter2` and emits `match.finished`. We only need to add the `match.updated` emit.

- [ ] **Step 1: Add `match.updated` emit in `update()`**

Open `Backend/src/matches/matches.service.ts`. After the `prisma.match.update` call (and before the `match.finished` block), add:

```typescript
async update(id: string, dto: UpdateMatchDto) {
  const match = await this.prisma.match.findUnique({ where: { id } });
  if (!match) throw new NotFoundException('Match not found');

  const updated = await this.prisma.match.update({
    where: { id },
    data: dto,
  });

  this.eventEmitter.emit('match.updated', { matchId: id });

  if (
    dto.status === MatchStatus.FINISHED &&
    dto.homeScore !== undefined &&
    dto.awayScore !== undefined
  ) {
    this.eventEmitter.emit('match.finished', new MatchResultEvent(id));
  }

  return updated;
}
```

- [ ] **Step 2: Build to verify**

```bash
cd Backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Backend
git add src/matches/matches.service.ts
git commit -m "feat(backend): emit match.updated event on match update"
```

---

## Task 4: Emit `prediction.saved` from PredictionsService

**Files:**
- Modify: `Backend/src/predictions/predictions.service.ts`

`PredictionsService` currently only injects `PrismaService`. We need to add `EventEmitter2`.

- [ ] **Step 1: Update PredictionsService**

Replace the full file `Backend/src/predictions/predictions.service.ts`:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';

@Injectable()
export class PredictionsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, roomId: string, dto: CreatePredictionDto) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this room');

    const match = await this.prisma.match.findUnique({
      where: { id: dto.matchId },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === MatchStatus.FINISHED) {
      throw new BadRequestException('Match is already finished');
    }

    this.assertNotLocked(match.matchDatetime);

    const earlyDeadline = new Date(
      match.matchDatetime.getTime() - 24 * 60 * 60 * 1000,
    );
    const isEarlyBonus = new Date() < earlyDeadline;

    const prediction = await this.prisma.prediction.create({
      data: {
        userId,
        roomId,
        matchId: dto.matchId,
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        isEarlyBonus,
      },
    });

    this.eventEmitter.emit('prediction.saved', { roomId });

    return prediction;
  }

  async findAllInRoom(userId: string, roomId: string) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this room');
    return this.prisma.prediction.findMany({
      where: { userId, roomId },
      include: { match: true },
      orderBy: { match: { matchDatetime: 'asc' } },
    });
  }

  async findOne(userId: string, roomId: string, matchId: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { userId_matchId_roomId: { userId, matchId, roomId } },
      include: { match: true },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    return prediction;
  }

  async update(
    userId: string,
    roomId: string,
    matchId: string,
    dto: Partial<CreatePredictionDto>,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === MatchStatus.FINISHED)
      throw new BadRequestException('Match is already finished');

    this.assertNotLocked(match.matchDatetime);

    const earlyDeadline = new Date(
      match.matchDatetime.getTime() - 24 * 60 * 60 * 1000,
    );
    const isEarlyBonus = new Date() < earlyDeadline;

    const existing = await this.prisma.prediction.findUnique({
      where: { userId_matchId_roomId: { userId, matchId, roomId } },
    });
    if (!existing) throw new NotFoundException('Prediction not found');

    const prediction = await this.prisma.prediction.update({
      where: { userId_matchId_roomId: { userId, matchId, roomId } },
      data: {
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        isEarlyBonus,
      },
    });

    this.eventEmitter.emit('prediction.saved', { roomId });

    return prediction;
  }

  private assertNotLocked(matchDatetime: Date) {
    const lockTime = new Date(matchDatetime.getTime() - 10 * 60 * 1000);
    if (new Date() >= lockTime) {
      throw new BadRequestException('Predictions are locked for this match');
    }
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd Backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Backend
git add src/predictions/predictions.service.ts
git commit -m "feat(backend): emit prediction.saved event on prediction create/update"
```

---

## Task 5: Emit `room.member.updated` from RoomsService

**Files:**
- Modify: `Backend/src/rooms/rooms.service.ts`

- [ ] **Step 1: Inject EventEmitter2 and emit events**

Open `Backend/src/rooms/rooms.service.ts`. Add the `EventEmitter2` import and inject it, then emit after `join()` and `kickMember()`:

```typescript
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateRoomDto) {
    return this.prisma.room.create({
      data: {
        name: dto.name,
        inviteCode: nanoid(8),
        ownerId: userId,
        members: { create: { userId } },
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async findAll(userId: string) {
    return this.prisma.room.findMany({
      where: { members: { some: { userId } } },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (!room.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a member of this room');
    }
    return room;
  }

  async remove(id: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId)
      throw new ForbiddenException('Only the owner can delete this room');
    await this.prisma.room.delete({ where: { id } });
  }

  async join(userId: string, inviteCode: string) {
    const room = await this.prisma.room.findUnique({ where: { inviteCode } });
    if (!room) throw new NotFoundException('Invalid invite code');

    const existing = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
    });
    if (existing) throw new ConflictException('Already a member of this room');

    await this.prisma.roomMember.create({ data: { roomId: room.id, userId } });

    this.eventEmitter.emit('room.member.updated', { roomId: room.id });

    return room;
  }

  async rotateInviteCode(id: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can rotate the invite code');
    }
    return this.prisma.room.update({
      where: { id },
      data: { inviteCode: nanoid(8) },
    });
  }

  async getMembers(id: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (!room.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a member');
    }
    return room.members;
  }

  async kickMember(roomId: string, targetUserId: string, requesterId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== requesterId)
      throw new ForbiddenException('Only the owner can kick members');
    if (targetUserId === requesterId)
      throw new ForbiddenException('Cannot kick yourself');
    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });

    this.eventEmitter.emit('room.member.updated', { roomId });
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd Backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Backend
git add src/rooms/rooms.service.ts
git commit -m "feat(backend): emit room.member.updated event on join and kick"
```

---

## Task 6: Create frontend socket singleton

**Files:**
- Create: `Frontend/lib/socket.ts`

- [ ] **Step 1: Install socket.io-client**

```bash
cd Frontend && npm install socket.io-client
```

Expected: `socket.io-client` appears in `package.json` dependencies.

- [ ] **Step 2: Create socket singleton**

`Frontend/lib/socket.ts`:

```typescript
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000', {
      withCredentials: true,
    })
  }
  return socket
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
cd Frontend
git add lib/socket.ts package.json package-lock.json
git commit -m "feat(frontend): add socket.io-client singleton"
```

---

## Task 7: Add WS subscription to useMatches

**Files:**
- Modify: `Frontend/hooks/useMatches.ts`

`useMatches` is the hook used by both `/matches` page and `/admin/matches` page. On `match:updated` it must invalidate `['matches']` so both pages refetch.

- [ ] **Step 1: Update useMatches.ts**

Replace the full file `Frontend/hooks/useMatches.ts`:

```typescript
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { Match, MatchStatus, MatchStage } from '@/types/api'

interface MatchFilters { status?: MatchStatus; stage?: MatchStage }

export function useMatches(filters: MatchFilters = {}) {
  const qc = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    const handler = () => qc.invalidateQueries({ queryKey: ['matches'] })
    socket.on('match:updated', handler)
    return () => { socket.off('match:updated', handler) }
  }, [qc])

  return useQuery({
    queryKey: ['matches', filters],
    queryFn: async () => {
      const { data } = await api.get<Match[]>('/matches', { params: filters })
      return data
    },
    staleTime: 60_000,
  })
}

export function useMatch(id: string) {
  const qc = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    const handler = (payload: { matchId: string }) => {
      if (payload.matchId === id) {
        qc.invalidateQueries({ queryKey: ['matches', id] })
      }
    }
    socket.on('match:updated', handler)
    return () => { socket.off('match:updated', handler) }
  }, [qc, id])

  return useQuery({
    queryKey: ['matches', id],
    queryFn: async () => {
      const { data } = await api.get<Match>(`/matches/${id}`)
      return data
    },
    staleTime: 30_000,
    enabled: !!id,
  })
}

export function useCreateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: {
      homeTeam: string
      awayTeam: string
      matchDatetime: string
      stage: MatchStage
      group?: string
    }) => api.post<Match>('/matches', dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      toast.success('Partido creado')
    },
    onError: () => toast.error('Error al crear partido'),
  })
}

export function useUpdateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...dto }: Partial<Match> & { id: string }) =>
      api.patch<Match>(`/matches/${id}`, dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      toast.success('Partido actualizado')
    },
    onError: () => toast.error('Error al actualizar partido'),
  })
}

export function useDeleteMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/matches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      toast.success('Partido eliminado')
    },
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Frontend
git add hooks/useMatches.ts
git commit -m "feat(frontend): subscribe to match:updated WS event in useMatches"
```

---

## Task 8: Add WS subscription to useLeaderboard

**Files:**
- Modify: `Frontend/hooks/useLeaderboard.ts`

- [ ] **Step 1: Update useLeaderboard.ts**

```typescript
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { LeaderboardEntry } from '@/types/api'

export function useLeaderboard(roomId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    const handler = () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'leaderboard'] })
    }
    socket.on('leaderboard:updated', handler)
    return () => { socket.off('leaderboard:updated', handler) }
  }, [qc, roomId])

  return useQuery({
    queryKey: ['rooms', roomId, 'leaderboard'],
    queryFn: async () => {
      const { data } = await api.get<LeaderboardEntry[]>(
        `/rooms/${roomId}/leaderboard`
      )
      return data
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!roomId,
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Frontend
git add hooks/useLeaderboard.ts
git commit -m "feat(frontend): subscribe to leaderboard:updated WS event in useLeaderboard"
```

---

## Task 9: Add WS subscription to usePredictions

**Files:**
- Modify: `Frontend/hooks/usePredictions.ts`

Only `usePredictions(roomId)` needs WS — mutation hooks already invalidate after success.

- [ ] **Step 1: Update usePredictions.ts**

Add `useEffect` import and WS subscription to the `usePredictions` function only. The rest of the file is unchanged:

```typescript
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { Prediction } from '@/types/api'

export function usePredictions(roomId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    const handler = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) {
        qc.invalidateQueries({ queryKey: ['rooms', roomId, 'predictions'] })
      }
    }
    socket.on('prediction:saved', handler)
    return () => { socket.off('prediction:saved', handler) }
  }, [qc, roomId])

  return useQuery({
    queryKey: ['rooms', roomId, 'predictions'],
    queryFn: async () => {
      const { data } = await api.get<Prediction[]>(`/rooms/${roomId}/predictions`)
      return data
    },
    staleTime: 15_000,
    enabled: !!roomId,
  })
}

export function usePrediction(roomId: string, matchId: string) {
  return useQuery({
    queryKey: ['rooms', roomId, 'predictions', matchId],
    queryFn: async () => {
      const { data } = await api.get<Prediction>(
        `/rooms/${roomId}/predictions/${matchId}`
      )
      return data
    },
    staleTime: 15_000,
    enabled: !!roomId && !!matchId,
  })
}

export function useCreatePrediction(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { matchId: string; homeScore: number; awayScore: number }) =>
      api.post<Prediction>(`/rooms/${roomId}/predictions`, dto).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'predictions'] })
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'leaderboard'] })
      toast.success('Predicción guardada')
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      toast.error(
        code === 'PREDICTION_LOCKED' ? 'Predicción bloqueada (< 10 min)' : 'Error al guardar'
      )
    },
  })
}

export function useUpdatePrediction(roomId: string, matchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { homeScore: number; awayScore: number }) =>
      api
        .patch<Prediction>(`/rooms/${roomId}/predictions/${matchId}`, dto)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'predictions'] })
      toast.success('Predicción actualizada')
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code
      toast.error(
        code === 'PREDICTION_LOCKED' ? 'Predicción bloqueada (< 10 min)' : 'Error al actualizar'
      )
    },
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Frontend
git add hooks/usePredictions.ts
git commit -m "feat(frontend): subscribe to prediction:saved WS event in usePredictions"
```

---

## Task 10: Add WS subscription to useRoomMembers

**Files:**
- Modify: `Frontend/hooks/useRoomMembers.ts`

- [ ] **Step 1: Update useRoomMembers.ts**

```typescript
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { RoomMember } from '@/types/api'

export function useRoomMembers(roomId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!roomId) return
    const socket = getSocket()
    const handler = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) {
        qc.invalidateQueries({ queryKey: ['rooms', roomId, 'members'] })
      }
    }
    socket.on('member:updated', handler)
    return () => { socket.off('member:updated', handler) }
  }, [qc, roomId])

  return useQuery({
    queryKey: ['rooms', roomId, 'members'],
    queryFn: async () => {
      const { data } = await api.get<RoomMember[]>(`/rooms/${roomId}/members`)
      return data
    },
    staleTime: 30_000,
    enabled: !!roomId,
  })
}

export function useKickMember(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/rooms/${roomId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', roomId, 'members'] })
      toast.success('Miembro eliminado')
    },
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Frontend
git add hooks/useRoomMembers.ts
git commit -m "feat(frontend): subscribe to member:updated WS event in useRoomMembers"
```

---

## Task 11: Subscribe to `leaderboard:updated` on home page stats

**Files:**
- Modify: `Frontend/app/(app)/page.tsx`

The home page uses `useQueries` with keys `['rooms', room.id, 'leaderboard', 'home']`. On `leaderboard:updated` we invalidate all queries matching `['rooms']` so all home stat queries refetch.

- [ ] **Step 1: Add WS subscription to HomePage**

Add `useEffect` import and the subscription inside `HomePage`. Insert after the `leaderboardQueries` declaration:

```typescript
'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useRooms } from '@/hooks/useRooms'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { CreateRoomDialog } from '@/components/features/rooms/CreateRoomDialog'
import { JoinRoomDialog } from '@/components/features/rooms/JoinRoomDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Flame, Target, Trophy } from 'lucide-react'
import api from '@/lib/api'
import { getSocket } from '@/lib/socket'
import type { LeaderboardEntry } from '@/types/api'
import { cn } from '@/lib/utils'

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const { data: rooms = [], isLoading: roomsLoading } = useRooms()

  const leaderboardQueries = useQueries({
    queries: rooms.map((room) => ({
      queryKey: ['rooms', room.id, 'leaderboard', 'home'],
      queryFn: async () => {
        const { data } = await api.get<LeaderboardEntry[]>(
          `/rooms/${room.id}/leaderboard`
        )
        return { roomId: room.id, entries: data }
      },
      staleTime: 30_000,
    })),
  })

  useEffect(() => {
    const socket = getSocket()
    const handler = () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
    }
    socket.on('leaderboard:updated', handler)
    return () => { socket.off('leaderboard:updated', handler) }
  }, [qc])

  const globalStats = leaderboardQueries.reduce(
    (acc, q) => {
      const entry = q.data?.entries.find((e) => e.user.id === user?.id)
      if (!entry) return acc
      return {
        totalPoints: acc.totalPoints + entry.totalPoints,
        predictionsCount: acc.predictionsCount + entry.predictionsCount,
        streakBonus: acc.streakBonus + entry.streakBonus,
      }
    },
    { totalPoints: 0, predictionsCount: 0, streakBonus: 0 }
  )

  const rankByRoom: Record<string, { rank: number; entry: LeaderboardEntry }> = {}
  leaderboardQueries.forEach((q) => {
    if (!q.data) return
    const idx = q.data.entries.findIndex((e) => e.user.id === user?.id)
    if (idx >= 0) {
      rankByRoom[q.data.roomId] = { rank: idx + 1, entry: q.data.entries[idx] }
    }
  })

  const statsLoading = leaderboardQueries.some((q) => q.isLoading)

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          value={statsLoading ? null : globalStats.totalPoints}
          label="pts totales"
          highlight
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          value={statsLoading ? null : globalStats.predictionsCount}
          label="predicciones"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-400" />}
          value={statsLoading ? null : globalStats.streakBonus}
          label="bonus racha"
          orange
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Mis Salas
        </h2>

        {roomsLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!roomsLoading && rooms.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no perteneces a ninguna sala.
          </p>
        )}

        {rooms.map((room) => {
          const info = rankByRoom[room.id]
          const isTop = info?.rank === 1
          return (
            <Link key={room.id} href={`/rooms/${room.id}`}>
              <Card
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/60',
                  isTop && 'border-primary/50 bg-accent/30'
                )}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{room.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {info
                        ? `${info.entry.predictionsCount} predicciones`
                        : 'Sin predicciones aún'}
                    </p>
                  </div>
                  {info && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">#{info.rank}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.entry.totalPoints} pts
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="flex gap-3">
        <CreateRoomDialog />
        <JoinRoomDialog />
      </div>
    </div>
  )
}

function StatCard({
  icon, value, label, highlight, orange,
}: {
  icon: React.ReactNode
  value: number | null
  label: string
  highlight?: boolean
  orange?: boolean
}) {
  return (
    <Card className={cn(highlight && 'border-primary/40 bg-accent/20')}>
      <CardContent className="flex flex-col items-center justify-center p-4 text-center">
        <div className={cn('mb-1', highlight ? 'text-primary' : orange ? 'text-orange-400' : 'text-muted-foreground')}>
          {icon}
        </div>
        {value === null ? (
          <Skeleton className="mb-1 h-8 w-12" />
        ) : (
          <p className={cn('text-3xl font-black', highlight ? 'text-primary' : orange ? 'text-orange-400' : '')}>
            {value}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd Frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd Frontend
git add app/\(app\)/page.tsx
git commit -m "feat(frontend): subscribe to leaderboard:updated WS event on home page"
```

---

## Task 12: End-to-end smoke test

- [ ] **Step 1: Start both servers**

In two separate terminals:
```bash
# Terminal 1
cd Backend && npm run start:dev

# Terminal 2
cd Frontend && npm run dev
```

- [ ] **Step 2: Verify WS connection in browser console**

Open `http://localhost:3001`, open DevTools → Network → WS tab. Should see a WebSocket connection to `localhost:3000/socket.io/?...` with status 101.

- [ ] **Step 3: Test match update propagation**

1. Open two browser tabs: Tab A = `http://localhost:3001/matches`, Tab B = `http://localhost:3001/admin/matches`
2. In Tab B, click edit on any match and change the status or score, click "Actualizar partido"
3. Tab A should update the match status/score within ~1 second without manual refresh

- [ ] **Step 4: Test leaderboard propagation**

1. Open Tab A = `http://localhost:3001/rooms/<any-room-id>` on Leaderboard tab
2. In Tab B, update a match to FINISHED with scores
3. Tab A leaderboard should refresh within ~1 second

- [ ] **Step 5: Test member list propagation**

1. Open Tab A = `http://localhost:3001/rooms/<any-room-id>` on Miembros tab
2. In Tab B (different user session or incognito), join the same room
3. Tab A members list should update within ~1 second
