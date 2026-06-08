# SureShot Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS REST API for a World Cup prediction app with rooms, scoring, and leaderboards.

**Architecture:** Modular monolith — one NestJS process, seven bounded modules, single Docker image scaled horizontally behind Nginx. Scores computed on-the-fly (no Score table). Auth dual-strategy: email/password + Google OAuth with JWT access tokens (15 min) + HttpOnly refresh token cookies (7 days).

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 16, Passport.js (JWT + Google), bcrypt, nanoid, class-validator, @nestjs/swagger, @nestjs/throttler, @nestjs/event-emitter, Docker, Nginx, k6

---

## File Map

```
src/
├── main.ts
├── app.module.ts
├── config/
│   └── env.validation.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/
│   ├── filters/
│   │   └── all-exceptions.filter.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   └── decorators/
│       ├── current-user.decorator.ts
│       ├── public.decorator.ts
│       └── roles.decorator.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── google.strategy.ts
│   └── dto/
│       ├── register.dto.ts
│       └── login.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       └── update-user.dto.ts
├── rooms/
│   ├── rooms.module.ts
│   ├── rooms.controller.ts
│   ├── rooms.service.ts
│   ├── rooms.service.spec.ts
│   └── dto/
│       ├── create-room.dto.ts
│       └── join-room.dto.ts
├── matches/
│   ├── matches.module.ts
│   ├── matches.controller.ts
│   ├── matches.service.ts
│   ├── matches.service.spec.ts
│   ├── events/
│   │   └── match-result.event.ts
│   └── dto/
│       ├── create-match.dto.ts
│       └── update-match.dto.ts
├── predictions/
│   ├── predictions.module.ts
│   ├── predictions.controller.ts
│   ├── predictions.service.ts
│   ├── predictions.service.spec.ts
│   └── dto/
│       └── create-prediction.dto.ts
├── scoring/
│   ├── scoring.module.ts
│   ├── scoring.service.ts
│   └── scoring.service.spec.ts
└── leaderboard/
    ├── leaderboard.module.ts
    ├── leaderboard.controller.ts
    └── leaderboard.service.ts

prisma/
├── schema.prisma
└── seed.ts

docker/
└── nginx.conf

Dockerfile
docker-compose.yml
docker-compose.prod.yml
.env.example
k6/
└── stress-test.js
```

---

## Sprint 0 — Project Base

### Task 1: Initialize NestJS project and install all dependencies

**Files:**
- Create: `package.json` (via nest new)
- Create: `.env.example`
- Create: `prisma/schema.prisma`
- Create: `docker-compose.yml`

- [ ] **Step 1: Scaffold NestJS project inside the repo root**

```bash
# Run from /Users/luismarca/Desktop/Fabrizzio/SureShot
npx @nestjs/cli new . --package-manager npm --skip-git
```

When prompted "Directory is not empty. Continue? (y/N)" → type `y`

- [ ] **Step 2: Install all runtime dependencies**

```bash
npm install @nestjs/config @nestjs/swagger @nestjs/throttler @nestjs/passport @nestjs/jwt @nestjs/event-emitter passport passport-jwt passport-google-oauth20 @prisma/client bcrypt nanoid class-validator class-transformer joi cookie-parser
```

- [ ] **Step 3: Install all dev dependencies**

```bash
npm install -D prisma @types/bcrypt @types/passport-jwt @types/passport-google-oauth20 @types/cookie-parser @types/express
```

- [ ] **Step 4: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 5: Create `.env.example`**

```bash
# .env.example
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sureshot"
JWT_SECRET="change_me_jwt_secret_min_32_chars"
JWT_REFRESH_SECRET="change_me_refresh_secret_min_32"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/v1/auth/google/callback"
FRONTEND_URL="http://localhost:3001"
PORT=3000
NODE_ENV=development
```

Copy to `.env` and fill real values for local dev.

- [ ] **Step 6: Create `docker-compose.yml` (dev — app + postgres only)**

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: sureshot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build:
      context: .
      target: development
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/sureshot
      JWT_SECRET: dev_jwt_secret_min_32_characters_here
      JWT_REFRESH_SECRET: dev_refresh_secret_min_32_chars
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: http://localhost:3000/api/v1/auth/google/callback
      FRONTEND_URL: http://localhost:3001
      NODE_ENV: development
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres
    command: npm run start:dev

volumes:
  postgres_data:
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize NestJS project with all dependencies"
```

---

### Task 2: Prisma schema + environment validation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/config/env.validation.ts`
- Create: `src/prisma/prisma.service.ts`
- Create: `src/prisma/prisma.module.ts`

- [ ] **Step 1: Write full Prisma schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum MatchStatus {
  SCHEDULED
  IN_PROGRESS
  FINISHED
}

enum MatchStage {
  GROUP
  ROUND_OF_16
  QUARTER_FINAL
  SEMI_FINAL
  FINAL
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String
  avatar       String?
  password     String?
  googleId     String?
  role         Role     @default(USER)
  refreshToken String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  ownedRooms  Room[]
  memberships RoomMember[]
  predictions Prediction[]
}

model Room {
  id         String   @id @default(uuid())
  name       String
  inviteCode String   @unique
  ownerId    String
  createdAt  DateTime @default(now())

  owner       User         @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  members     RoomMember[]
  predictions Prediction[]
}

model RoomMember {
  id       String   @id @default(uuid())
  roomId   String
  userId   String
  joinedAt DateTime @default(now())

  room Room @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([roomId, userId])
}

model Match {
  id            String      @id @default(uuid())
  homeTeam      String
  awayTeam      String
  matchDatetime DateTime
  homeScore     Int?
  awayScore     Int?
  status        MatchStatus @default(SCHEDULED)
  stage         MatchStage
  group         String?

  predictions Prediction[]
}

model Prediction {
  id           String   @id @default(uuid())
  userId       String
  matchId      String
  roomId       String
  homeScore    Int
  awayScore    Int
  isEarlyBonus Boolean  @default(false)
  submittedAt  DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)
  room  Room  @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@unique([userId, matchId, roomId])
}
```

- [ ] **Step 2: Create env validation schema**

```typescript
// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required(),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3001'),
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
```

- [ ] **Step 3: Create PrismaService**

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: Create PrismaModule (global)**

```typescript
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Run first migration**

```bash
npx prisma migrate dev --name init
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/prisma src/config
git commit -m "feat: add Prisma schema and PrismaService"
```

---

### Task 3: App module, global exception filter, Swagger, rate limiting

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/main.ts`
- Create: `src/common/filters/all-exceptions.filter.ts`

- [ ] **Step 1: Create global exception filter**

```typescript
// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = typeof res === 'string' ? res : res.message ?? exception.message;
      code = typeof res === 'object' ? (res.error ?? 'HTTP_ERROR') : 'HTTP_ERROR';
      details = typeof res === 'object' && Array.isArray(res.message) ? res.message : [];
    }

    response.status(status).json({ error: { code, message, details } });
  }
}
```

- [ ] **Step 2: Create common guards and decorators**

```typescript
// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
```

- [ ] **Step 3: Update app.module.ts**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    // modules added per sprint below
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 4: Update main.ts**

```typescript
// src/main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SureShot API')
    .setDescription('World Cup prediction app REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 5: Add health endpoint to AppModule**

Create `src/app.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

Add `AppController` to `AppModule` controllers array:
```typescript
// in app.module.ts
import { AppController } from './app.controller';
// add to @Module({ controllers: [AppController], ... })
```

- [ ] **Step 6: Start app and verify Swagger is accessible**

```bash
npx prisma generate && npm run start:dev
```

Open `http://localhost:3000/api/docs` — Swagger UI must load.
Open `http://localhost:3000/api/v1/health` — must return `{"status":"ok"}`.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat(sprint-0): app scaffold, exception filter, Swagger, rate limiting"
```

---

## Sprint 1 — Auth + Users

### Task 4: Auth DTOs, strategies, and AuthService (email/password + JWT)

**Files:**
- Create: `src/auth/dto/register.dto.ts`
- Create: `src/auth/dto/login.dto.ts`
- Create: `src/auth/strategies/jwt.strategy.ts`
- Create: `src/auth/strategies/google.strategy.ts`
- Create: `src/auth/auth.service.ts`
- Create: `src/auth/auth.service.spec.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
```

```typescript
// src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
```

- [ ] **Step 2: Write failing tests for AuthService**

```typescript
// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockUser = {
  id: 'user-id-1',
  email: 'test@example.com',
  name: 'Test User',
  password: null as string | null,
  googleId: null,
  role: 'USER',
  refreshToken: null,
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let jwt: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue('token_value'), verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test_secret') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.register({ email: 'test@example.com', name: 'Test', password: 'pass1234' }, res),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password and creates user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...mockUser });
      prisma.user.update.mockResolvedValue({ ...mockUser });
      const res = { cookie: jest.fn() } as any;

      await service.register({ email: 'new@example.com', name: 'New', password: 'pass1234' }, res);

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('new@example.com');
      expect(createCall.data.password).not.toBe('pass1234');
      const isHashed = await bcrypt.compare('pass1234', createCall.data.password);
      expect(isHashed).toBe(true);
    });

    it('returns accessToken', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...mockUser });
      prisma.user.update.mockResolvedValue({ ...mockUser });
      const res = { cookie: jest.fn() } as any;

      const result = await service.register(
        { email: 'new@example.com', name: 'New', password: 'pass1234' },
        res,
      );
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass1234' }, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct_pass', 12);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hash });
      const res = { cookie: jest.fn() } as any;

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong_pass' }, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns accessToken on valid credentials', async () => {
      const hash = await bcrypt.hash('pass1234', 12);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hash });
      prisma.user.update.mockResolvedValue({ ...mockUser });
      const res = { cookie: jest.fn() } as any;

      const result = await service.login({ email: 'test@example.com', password: 'pass1234' }, res);
      expect(result).toHaveProperty('accessToken');
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Expected: FAIL — `AuthService` not found.

- [ ] **Step 4: Implement AuthService**

```typescript
// src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto, res: Response) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, password: hashedPassword },
    });

    return this.issueTokens(user, res);
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.password) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user, res);
  }

  async googleLogin(googleUser: { googleId: string; email: string; name: string; avatar?: string }, res: Response) {
    let user = await this.prisma.user.findFirst({ where: { googleId: googleUser.googleId } });

    if (!user) {
      const existing = await this.prisma.user.findUnique({ where: { email: googleUser.email } });
      if (existing) {
        user = await this.prisma.user.update({
          where: { id: existing.id },
          data: { googleId: googleUser.googleId, avatar: googleUser.avatar },
        });
      } else {
        user = await this.prisma.user.create({ data: googleUser });
      }
    }

    return this.issueTokens(user, res);
  }

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    let payload: { sub: string; email: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.refreshToken) throw new UnauthorizedException('Session expired');

    const valid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    return this.issueTokens(user, res);
  }

  async logout(userId: string, res: Response) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    res.clearCookie('refresh_token');
  }

  private async issueTokens(user: User, res: Response) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshToken: hashedRefresh } });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password, refreshToken: _rt, ...safeUser } = user as any;
    return { accessToken, user: safeUser };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Expected: PASS — 5 tests.

- [ ] **Step 6: Create JWT and Google strategies**

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

```typescript
// src/auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: any, done: VerifyCallback) {
    done(null, {
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    });
  }
}
```

- [ ] **Step 7: Create JwtAuthGuard**

```typescript
// src/common/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add src/auth src/common
git commit -m "feat(sprint-1): AuthService with email/password, JWT strategies, guards"
```

---

### Task 5: AuthController, AuthModule, UsersModule

**Files:**
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.module.ts`
- Create: `src/users/users.service.ts`
- Create: `src/users/users.controller.ts`
- Create: `src/users/users.module.ts`
- Create: `src/users/dto/update-user.dto.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create AuthController**

```typescript
// src/auth/auth.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(dto, res);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.googleLogin(req.user as any, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(req.cookies['refresh_token'], res);
  }

  @Delete('logout')
  @ApiBearerAuth()
  @HttpCode(204)
  logout(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(user.id, res);
  }
}
```

- [ ] **Step 2: Create AuthModule**

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 3: Create UpdateUserDto**

```typescript
// src/users/dto/update-user.dto.ts
import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatar?: string;
}
```

- [ ] **Step 4: Create UsersService**

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, avatar: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, name: true, avatar: true, role: true, updatedAt: true },
    });
  }
}
```

- [ ] **Step 5: Create UsersController**

```typescript
// src/users/users.controller.ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.findMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto);
  }
}
```

- [ ] **Step 6: Create UsersModule**

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 7: Register AuthModule and UsersModule in AppModule**

```typescript
// src/app.module.ts  — add to imports array:
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
// imports: [..., AuthModule, UsersModule]
```

- [ ] **Step 8: Verify auth endpoints work**

```bash
npm run start:dev
# In another terminal:
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","name":"Admin","password":"password123"}' | jq .
```

Expected: `{ "accessToken": "...", "user": { "id": "...", ... } }`

- [ ] **Step 9: Commit**

```bash
git add src/auth src/users src/app.module.ts
git commit -m "feat(sprint-1): auth controller, users module, JWT global guard"
```

---

## Sprint 2 — Rooms

### Task 6: RoomsService with TDD

**Files:**
- Create: `src/rooms/rooms.service.ts`
- Create: `src/rooms/rooms.service.spec.ts`
- Create: `src/rooms/dto/create-room.dto.ts`
- Create: `src/rooms/dto/join-room.dto.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// src/rooms/dto/create-room.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'Mundial 2026 - Amigos' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  name: string;
}
```

```typescript
// src/rooms/dto/join-room.dto.ts
import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinRoomDto {
  @ApiProperty({ example: 'abc12345' })
  @IsString()
  @Length(8, 8)
  inviteCode: string;
}
```

- [ ] **Step 2: Write failing tests for RoomsService**

```typescript
// src/rooms/rooms.service.spec.ts
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';

const userId = 'user-1';
const roomId = 'room-1';

const mockRoom = {
  id: roomId,
  name: 'Test Room',
  inviteCode: 'abc12345',
  ownerId: userId,
  createdAt: new Date(),
  members: [{ userId, roomId, id: 'm1', joinedAt: new Date(), user: { id: userId, name: 'Test', avatar: null } }],
};

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      room: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      roomMember: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [RoomsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RoomsService);
  });

  describe('create', () => {
    it('creates room with inviteCode and auto-joins owner', async () => {
      prisma.room.create.mockResolvedValue(mockRoom);
      const result = await service.create(userId, { name: 'Test Room' });
      expect(prisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: userId,
            members: { create: { userId } },
          }),
        }),
      );
      expect(result.id).toBe(roomId);
    });
  });

  describe('join', () => {
    it('throws NotFoundException for invalid invite code', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.join(userId, 'invalid1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if already member', async () => {
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });
      await expect(service.join(userId, 'abc12345')).rejects.toThrow(ConflictException);
    });

    it('creates membership when code valid and not yet member', async () => {
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      prisma.roomMember.findUnique.mockResolvedValue(null);
      prisma.roomMember.create.mockResolvedValue({});
      await service.join('new-user', 'abc12345');
      expect(prisma.roomMember.create).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException if requester is not owner', async () => {
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      await expect(service.remove(roomId, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('deletes room when requester is owner', async () => {
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      prisma.room.delete.mockResolvedValue({});
      await service.remove(roomId, userId);
      expect(prisma.room.delete).toHaveBeenCalled();
    });
  });

  describe('kickMember', () => {
    it('throws ForbiddenException if kicker is not owner', async () => {
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      await expect(service.kickMember(roomId, 'target', 'not-owner')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if owner tries to kick themselves', async () => {
      prisma.room.findUnique.mockResolvedValue(mockRoom);
      await expect(service.kickMember(roomId, userId, userId)).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 3: Run to verify they fail**

```bash
npx jest src/rooms/rooms.service.spec.ts --no-coverage
```

Expected: FAIL — `RoomsService` not found.

- [ ] **Step 4: Implement RoomsService**

```typescript
// src/rooms/rooms.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

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
    if (room.ownerId !== userId) throw new ForbiddenException('Only the owner can delete this room');
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
    return room;
  }

  async rotateInviteCode(id: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can rotate the invite code');
    }
    return this.prisma.room.update({ where: { id }, data: { inviteCode: nanoid(8) } });
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
    if (room.ownerId !== requesterId) throw new ForbiddenException('Only the owner can kick members');
    if (targetUserId === requesterId) throw new ForbiddenException('Cannot kick yourself');
    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
  }
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npx jest src/rooms/rooms.service.spec.ts --no-coverage
```

Expected: PASS — 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/rooms
git commit -m "feat(sprint-2): RoomsService with invite codes and membership"
```

---

### Task 7: RoomsController and RoomsModule

**Files:**
- Create: `src/rooms/rooms.controller.ts`
- Create: `src/rooms/rooms.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create RoomsController**

```typescript
// src/rooms/rooms.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.roomsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.findOne(id, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.remove(id, user.id);
  }

  @Post('join')
  @HttpCode(200)
  join(@CurrentUser() user: any, @Body() dto: JoinRoomDto) {
    return this.roomsService.join(user.id, dto.inviteCode);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.getMembers(id, user.id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  kickMember(
    @Param('id') roomId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.roomsService.kickMember(roomId, targetUserId, user.id);
  }

  @Post(':id/invites')
  rotateInviteCode(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.rotateInviteCode(id, user.id);
  }
}
```

- [ ] **Step 2: Create RoomsModule and register in AppModule**

```typescript
// src/rooms/rooms.module.ts
import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
```

Add to `src/app.module.ts` imports: `RoomsModule`

- [ ] **Step 3: Smoke test**

```bash
# Register user first, then:
TOKEN="<accessToken from register response>"
curl -s -X POST http://localhost:3000/api/v1/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sala Test"}' | jq .
```

Expected: room object with `inviteCode` (8 chars).

- [ ] **Step 4: Commit**

```bash
git add src/rooms src/app.module.ts
git commit -m "feat(sprint-2): rooms controller and module wired up"
```

---

## Sprint 3 — Matches

### Task 8: MatchResultEvent, MatchesService with TDD, MatchesController

**Files:**
- Create: `src/matches/events/match-result.event.ts`
- Create: `src/matches/dto/create-match.dto.ts`
- Create: `src/matches/dto/update-match.dto.ts`
- Create: `src/matches/matches.service.ts`
- Create: `src/matches/matches.service.spec.ts`
- Create: `src/matches/matches.controller.ts`
- Create: `src/matches/matches.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create event class and DTOs**

```typescript
// src/matches/events/match-result.event.ts
export class MatchResultEvent {
  constructor(public readonly matchId: string) {}
}
```

```typescript
// src/matches/dto/create-match.dto.ts
import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStage } from '@prisma/client';

export class CreateMatchDto {
  @ApiProperty({ example: 'Argentina' })
  @IsString()
  homeTeam: string;

  @ApiProperty({ example: 'France' })
  @IsString()
  awayTeam: string;

  @ApiProperty({ example: '2026-06-15T18:00:00Z' })
  @IsDateString()
  matchDatetime: string;

  @ApiProperty({ enum: MatchStage })
  @IsEnum(MatchStage)
  stage: MatchStage;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  group?: string;
}
```

```typescript
// src/matches/dto/update-match.dto.ts
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus, MatchStage } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';
import { CreateMatchDto } from './create-match.dto';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number;
}
```

- [ ] **Step 2: Write failing tests for MatchesService**

```typescript
// src/matches/matches.service.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MatchStatus } from '@prisma/client';
import { MatchesService } from './matches.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMatch = {
  id: 'match-1',
  homeTeam: 'Argentina',
  awayTeam: 'France',
  matchDatetime: new Date('2026-06-15T18:00:00Z'),
  homeScore: null,
  awayScore: null,
  status: MatchStatus.SCHEDULED,
  stage: 'FINAL',
  group: null,
};

describe('MatchesService', () => {
  let service: MatchesService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      match: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    eventEmitter = { emit: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = module.get(MatchesService);
  });

  describe('update', () => {
    it('throws NotFoundException when match not found', async () => {
      prisma.match.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-id', {})).rejects.toThrow(NotFoundException);
    });

    it('emits match.finished event when status set to FINISHED with scores', async () => {
      prisma.match.findUnique.mockResolvedValue(mockMatch);
      prisma.match.update.mockResolvedValue({ ...mockMatch, homeScore: 2, awayScore: 1, status: MatchStatus.FINISHED });

      await service.update('match-1', { status: MatchStatus.FINISHED, homeScore: 2, awayScore: 1 });

      expect(eventEmitter.emit).toHaveBeenCalledWith('match.finished', expect.objectContaining({ matchId: 'match-1' }));
    });

    it('does NOT emit event when status is not FINISHED', async () => {
      prisma.match.findUnique.mockResolvedValue(mockMatch);
      prisma.match.update.mockResolvedValue({ ...mockMatch, status: MatchStatus.IN_PROGRESS });

      await service.update('match-1', { status: MatchStatus.IN_PROGRESS });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when match not found', async () => {
      prisma.match.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify fail**

```bash
npx jest src/matches/matches.service.spec.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 4: Implement MatchesService**

```typescript
// src/matches/matches.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchResultEvent } from './events/match-result.event';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService, private eventEmitter: EventEmitter2) {}

  async create(dto: CreateMatchDto) {
    return this.prisma.match.create({ data: { ...dto } });
  }

  async findAll(status?: MatchStatus, stage?: string) {
    return this.prisma.match.findMany({
      where: {
        ...(status && { status }),
        ...(stage && { stage: stage as any }),
      },
      orderBy: { matchDatetime: 'asc' },
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async update(id: string, dto: UpdateMatchDto) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');

    const updated = await this.prisma.match.update({ where: { id }, data: dto });

    if (
      dto.status === MatchStatus.FINISHED &&
      dto.homeScore !== undefined &&
      dto.awayScore !== undefined
    ) {
      this.eventEmitter.emit('match.finished', new MatchResultEvent(id));
    }

    return updated;
  }

  async remove(id: string) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');
    await this.prisma.match.delete({ where: { id } });
  }
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npx jest src/matches/matches.service.spec.ts --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 6: Create MatchesController and MatchesModule**

```typescript
// src/matches/matches.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MatchStatus, MatchStage, Role } from '@prisma/client';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Public()
  @Get()
  @ApiQuery({ name: 'status', enum: MatchStatus, required: false })
  @ApiQuery({ name: 'stage', enum: MatchStage, required: false })
  findAll(@Query('status') status?: MatchStatus, @Query('stage') stage?: string) {
    return this.matchesService.findAll(status, stage);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchesService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateMatchDto) {
    return this.matchesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matchesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.matchesService.remove(id);
  }
}
```

```typescript
// src/matches/matches.module.ts
import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
```

Add `MatchesModule` to `src/app.module.ts` imports.

- [ ] **Step 7: Commit**

```bash
git add src/matches src/app.module.ts
git commit -m "feat(sprint-3): matches module with admin CRUD and result event"
```

---

## Sprint 4 — Predictions

### Task 9: PredictionsService with TDD + PredictionsController

**Files:**
- Create: `src/predictions/dto/create-prediction.dto.ts`
- Create: `src/predictions/predictions.service.ts`
- Create: `src/predictions/predictions.service.spec.ts`
- Create: `src/predictions/predictions.controller.ts`
- Create: `src/predictions/predictions.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create DTO**

```typescript
// src/predictions/dto/create-prediction.dto.ts
import { IsInt, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePredictionDto {
  @ApiProperty({ example: 'match-uuid-here' })
  @IsUUID()
  matchId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  homeScore: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  awayScore: number;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// src/predictions/predictions.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PredictionsService } from './predictions.service';
import { PrismaService } from '../prisma/prisma.service';

const userId = 'user-1';
const roomId = 'room-1';
const matchId = 'match-1';

const makeMatch = (overrides: Partial<{ status: MatchStatus; matchDatetime: Date }> = {}) => ({
  id: matchId,
  homeTeam: 'Argentina',
  awayTeam: 'France',
  homeScore: null,
  awayScore: null,
  status: MatchStatus.SCHEDULED,
  stage: 'FINAL',
  group: null,
  matchDatetime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h in future
  ...overrides,
});

describe('PredictionsService', () => {
  let service: PredictionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      roomMember: { findUnique: jest.fn() },
      match: { findUnique: jest.fn() },
      prediction: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [PredictionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PredictionsService);
  });

  describe('create', () => {
    it('throws ForbiddenException if user is not a room member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);
      await expect(
        service.create(userId, roomId, { matchId, homeScore: 2, awayScore: 1 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when match not found', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.match.findUnique.mockResolvedValue(null);
      await expect(
        service.create(userId, roomId, { matchId, homeScore: 2, awayScore: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when match is FINISHED', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.match.findUnique.mockResolvedValue(makeMatch({ status: MatchStatus.FINISHED }));
      await expect(
        service.create(userId, roomId, { matchId, homeScore: 2, awayScore: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException within 10 minutes of match', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });
      const soon = new Date(Date.now() + 5 * 60 * 1000); // 5 min away
      prisma.match.findUnique.mockResolvedValue(makeMatch({ matchDatetime: soon }));
      await expect(
        service.create(userId, roomId, { matchId, homeScore: 2, awayScore: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets isEarlyBonus true when prediction submitted > 24h before match', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.match.findUnique.mockResolvedValue(makeMatch()); // 48h in future
      prisma.prediction.create.mockResolvedValue({ id: 'pred-1', isEarlyBonus: true });

      await service.create(userId, roomId, { matchId, homeScore: 2, awayScore: 1 });

      const createCall = prisma.prediction.create.mock.calls[0][0];
      expect(createCall.data.isEarlyBonus).toBe(true);
    });

    it('sets isEarlyBonus false when prediction submitted < 24h before match', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });
      const inSixHours = new Date(Date.now() + 6 * 60 * 60 * 1000);
      prisma.match.findUnique.mockResolvedValue(makeMatch({ matchDatetime: inSixHours }));
      prisma.prediction.create.mockResolvedValue({ id: 'pred-1', isEarlyBonus: false });

      await service.create(userId, roomId, { matchId, homeScore: 2, awayScore: 1 });

      const createCall = prisma.prediction.create.mock.calls[0][0];
      expect(createCall.data.isEarlyBonus).toBe(false);
    });
  });

  describe('update', () => {
    it('throws BadRequestException when within 10 min of match', async () => {
      const soon = new Date(Date.now() + 5 * 60 * 1000);
      prisma.match.findUnique.mockResolvedValue(makeMatch({ matchDatetime: soon }));
      await expect(
        service.update(userId, roomId, matchId, { homeScore: 1, awayScore: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
npx jest src/predictions/predictions.service.spec.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 4: Implement PredictionsService**

```typescript
// src/predictions/predictions.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';

@Injectable()
export class PredictionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, roomId: string, dto: CreatePredictionDto) {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this room');

    const match = await this.prisma.match.findUnique({ where: { id: dto.matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === MatchStatus.FINISHED) {
      throw new BadRequestException('Match is already finished');
    }

    this.assertNotLocked(match.matchDatetime);

    const earlyDeadline = new Date(match.matchDatetime.getTime() - 24 * 60 * 60 * 1000);
    const isEarlyBonus = new Date() < earlyDeadline;

    return this.prisma.prediction.create({
      data: { userId, roomId, matchId: dto.matchId, homeScore: dto.homeScore, awayScore: dto.awayScore, isEarlyBonus },
    });
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

  async update(userId: string, roomId: string, matchId: string, dto: Partial<CreatePredictionDto>) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.status === MatchStatus.FINISHED) throw new BadRequestException('Match is already finished');

    this.assertNotLocked(match.matchDatetime);

    const earlyDeadline = new Date(match.matchDatetime.getTime() - 24 * 60 * 60 * 1000);
    const isEarlyBonus = new Date() < earlyDeadline;

    const existing = await this.prisma.prediction.findUnique({
      where: { userId_matchId_roomId: { userId, matchId, roomId } },
    });
    if (!existing) throw new NotFoundException('Prediction not found');

    return this.prisma.prediction.update({
      where: { userId_matchId_roomId: { userId, matchId, roomId } },
      data: { homeScore: dto.homeScore, awayScore: dto.awayScore, isEarlyBonus },
    });
  }

  private assertNotLocked(matchDatetime: Date) {
    const lockTime = new Date(matchDatetime.getTime() - 10 * 60 * 1000);
    if (new Date() >= lockTime) {
      throw new BadRequestException('Predictions are locked for this match');
    }
  }
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npx jest src/predictions/predictions.service.spec.ts --no-coverage
```

Expected: PASS — 7 tests.

- [ ] **Step 6: Create PredictionsController and PredictionsModule**

```typescript
// src/predictions/predictions.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PredictionsService } from './predictions.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('predictions')
@ApiBearerAuth()
@Controller('rooms/:roomId/predictions')
export class PredictionsController {
  constructor(private predictionsService: PredictionsService) {}

  @Post()
  create(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: CreatePredictionDto,
  ) {
    return this.predictionsService.create(user.id, roomId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Param('roomId') roomId: string) {
    return this.predictionsService.findAllInRoom(user.id, roomId);
  }

  @Get(':matchId')
  findOne(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.predictionsService.findOne(user.id, roomId, matchId);
  }

  @Patch(':matchId')
  update(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Param('matchId') matchId: string,
    @Body() dto: Partial<CreatePredictionDto>,
  ) {
    return this.predictionsService.update(user.id, roomId, matchId, dto);
  }
}
```

```typescript
// src/predictions/predictions.module.ts
import { Module } from '@nestjs/common';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';

@Module({
  controllers: [PredictionsController],
  providers: [PredictionsService],
})
export class PredictionsModule {}
```

Add `PredictionsModule` to `src/app.module.ts` imports.

- [ ] **Step 7: Commit**

```bash
git add src/predictions src/app.module.ts
git commit -m "feat(sprint-4): predictions module with timing validation and early bonus"
```

---

## Sprint 5 — Scoring Engine + Leaderboard

### Task 10: ScoringService with TDD

**Files:**
- Create: `src/scoring/scoring.service.ts`
- Create: `src/scoring/scoring.service.spec.ts`
- Create: `src/scoring/scoring.module.ts`

- [ ] **Step 1: Write failing tests for ScoringService**

```typescript
// src/scoring/scoring.service.spec.ts
import { Test } from '@nestjs/testing';
import { ScoringService } from './scoring.service';

const match = (homeScore: number, awayScore: number) => ({ homeScore, awayScore } as any);
const pred = (homeScore: number, awayScore: number, isEarlyBonus = false) =>
  ({ homeScore, awayScore, isEarlyBonus } as any);

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [ScoringService] }).compile();
    service = module.get(ScoringService);
  });

  describe('computeBasePoints', () => {
    it('returns 5 for exact result (2-1 vs 2-1)', () => {
      expect(service.computeBasePoints(pred(2, 1), match(2, 1))).toBe(5);
    });

    it('returns 3 for correct winner, wrong scoreline', () => {
      expect(service.computeBasePoints(pred(3, 0), match(2, 1))).toBe(3);
    });

    it('returns 5 for correct winner + correct goal diff (not exact)', () => {
      // pred 3-2, match 2-1 — both home wins by 1
      expect(service.computeBasePoints(pred(3, 2), match(2, 1))).toBe(5);
    });

    it('returns 0 for wrong winner', () => {
      expect(service.computeBasePoints(pred(0, 2), match(2, 1))).toBe(0);
    });

    it('returns 3 for correct draw (different scores)', () => {
      // pred 0-0, match 1-1 — both draws
      expect(service.computeBasePoints(pred(0, 0), match(1, 1))).toBe(3);
    });

    it('returns 5 for exact draw (1-1 vs 1-1)', () => {
      expect(service.computeBasePoints(pred(1, 1), match(1, 1))).toBe(5);
    });

    it('returns 0 when match scores are null (not finished)', () => {
      expect(service.computeBasePoints(pred(2, 1), { homeScore: null, awayScore: null } as any)).toBe(0);
    });

    it('does NOT add early bonus (early bonus handled separately)', () => {
      expect(service.computeBasePoints(pred(2, 1, true), match(2, 1))).toBe(5);
      expect(service.computeBasePoints(pred(2, 1, false), match(2, 1))).toBe(5);
    });
  });

  describe('computeStreakBonus', () => {
    it('returns 0 for fewer than 3 correct', () => {
      expect(service.computeStreakBonus([3, 3])).toBe(0);
    });

    it('returns 2 for exactly 3 consecutive correct', () => {
      expect(service.computeStreakBonus([3, 5, 3])).toBe(2);
    });

    it('returns 4 for 6 consecutive correct', () => {
      expect(service.computeStreakBonus([3, 5, 3, 3, 5, 3])).toBe(4);
    });

    it('resets streak on wrong prediction (0 points)', () => {
      // 2 correct, 1 wrong, 3 correct → no bonus in first group, 2 bonus in second
      expect(service.computeStreakBonus([3, 3, 0, 3, 3, 3])).toBe(2);
    });

    it('returns 0 for all wrong', () => {
      expect(service.computeStreakBonus([0, 0, 0, 0])).toBe(0);
    });

    it('returns 0 for goal-diff-only predictions (2 points < 3 threshold)', () => {
      // 2 pts = only goal diff correct but wrong winner — shouldn't count for streak
      // Actually: 2 pts means correct goal diff but if predDiff === matchDiff then predWinner === matchWinner
      // So 2 pts alone is impossible (you'd have 3+2=5 or 3). 
      // This test documents that < 3 doesn't count.
      expect(service.computeStreakBonus([2, 2, 2])).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest src/scoring/scoring.service.spec.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Implement ScoringService**

```typescript
// src/scoring/scoring.service.ts
import { Injectable } from '@nestjs/common';
import { Match, Prediction } from '@prisma/client';

@Injectable()
export class ScoringService {
  computeBasePoints(
    prediction: Pick<Prediction, 'homeScore' | 'awayScore'>,
    match: Pick<Match, 'homeScore' | 'awayScore'>,
  ): number {
    if (match.homeScore === null || match.awayScore === null) return 0;

    if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
      return 5;
    }

    let points = 0;
    const predDiff = prediction.homeScore - prediction.awayScore;
    const matchDiff = match.homeScore - match.awayScore;

    if (Math.sign(predDiff) === Math.sign(matchDiff)) points += 3;
    if (predDiff === matchDiff) points += 2;

    return points;
  }

  computeStreakBonus(basePointsPerPrediction: number[]): number {
    let streak = 0;
    let bonus = 0;
    for (const points of basePointsPerPrediction) {
      if (points >= 3) {
        streak++;
        if (streak % 3 === 0) bonus += 2;
      } else {
        streak = 0;
      }
    }
    return bonus;
  }
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx jest src/scoring/scoring.service.spec.ts --no-coverage
```

Expected: PASS — 13 tests.

- [ ] **Step 5: Create ScoringModule**

```typescript
// src/scoring/scoring.module.ts
import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';

@Module({
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
```

- [ ] **Step 6: Commit**

```bash
git add src/scoring
git commit -m "feat(sprint-5): scoring engine with exact/winner/diff/streak rules"
```

---

### Task 11: LeaderboardService and LeaderboardController

**Files:**
- Create: `src/leaderboard/leaderboard.service.ts`
- Create: `src/leaderboard/leaderboard.controller.ts`
- Create: `src/leaderboard/leaderboard.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Implement LeaderboardService**

```typescript
// src/leaderboard/leaderboard.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService, private scoring: ScoringService) {}

  async getLeaderboard(roomId: string, requesterId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: requesterId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this room');

    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    const rankings = await Promise.all(
      members.map(async (member) => {
        const predictions = await this.prisma.prediction.findMany({
          where: { userId: member.userId, roomId, match: { status: MatchStatus.FINISHED } },
          include: { match: true },
          orderBy: { match: { matchDatetime: 'asc' } },
        });

        const basePointsArray = predictions.map((p) =>
          this.scoring.computeBasePoints(p, p.match),
        );
        const earlyBonuses = predictions.filter((p) => p.isEarlyBonus).length;
        const baseTotal = basePointsArray.reduce((sum, pts) => sum + pts, 0);
        const streakBonus = this.scoring.computeStreakBonus(basePointsArray);
        const totalPoints = baseTotal + earlyBonuses + streakBonus;

        return {
          user: member.user,
          totalPoints,
          basePoints: baseTotal,
          earlyBonuses,
          streakBonus,
          predictionsCount: predictions.length,
        };
      }),
    );

    return rankings.sort((a, b) => b.totalPoints - a.totalPoints);
  }
}
```

- [ ] **Step 2: Create LeaderboardController**

```typescript
// src/leaderboard/leaderboard.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('leaderboard')
@ApiBearerAuth()
@Controller('rooms/:roomId/leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@Param('roomId') roomId: string, @CurrentUser() user: any) {
    return this.leaderboardService.getLeaderboard(roomId, user.id);
  }
}
```

- [ ] **Step 3: Create LeaderboardModule**

```typescript
// src/leaderboard/leaderboard.module.ts
import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [ScoringModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
```

Add `LeaderboardModule` and `ScoringModule` to `src/app.module.ts` imports.

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: End-to-end smoke test leaderboard**

```bash
# 1. Register two users, login, create room, user2 joins with invite code
# 2. Admin creates a match, both users predict
# 3. Admin sets match FINISHED with result
# 4. Poll leaderboard:
curl -s http://localhost:3000/api/v1/rooms/<roomId>/leaderboard \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: array sorted by `totalPoints` DESC.

- [ ] **Step 6: Commit**

```bash
git add src/leaderboard src/app.module.ts
git commit -m "feat(sprint-5): leaderboard aggregation with scoring engine"
```

---

## Sprint 6 — Docker + Horizontal Scaling + Stress Testing

### Task 12: Multi-stage Dockerfile + Nginx load balancer

**Files:**
- Create: `Dockerfile`
- Create: `docker/nginx.conf`
- Create: `docker-compose.prod.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
dist
.env
*.md
.git
coverage
```

- [ ] **Step 2: Create multi-stage Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
USER appuser
EXPOSE 3000
CMD ["node", "dist/main"]
```

Update `docker-compose.yml` to add a `development` target — add `target: development` under `build` key and update the `app` service `build` section:

```yaml
# in docker-compose.yml, app service:
build:
  context: .
  dockerfile: Dockerfile
  target: runner
```

- [ ] **Step 3: Create `docker/nginx.conf`**

```nginx
upstream sureshot_api {
    server app:3000;
}

server {
    listen 80;

    location / {
        proxy_pass         http://sureshot_api;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] **Step 4: Create `docker-compose.prod.yml`**

```yaml
version: '3.9'
services:
  app:
    build:
      context: .
      target: runner
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/sureshot
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_CALLBACK_URL: ${GOOGLE_CALLBACK_URL}
      FRONTEND_URL: ${FRONTEND_URL}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sureshot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app

volumes:
  postgres_data:
```

- [ ] **Step 5: Build and test with 3 replicas**

```bash
# Create a prod .env with required vars, then:
docker compose -f docker-compose.prod.yml up --build --scale app=3 -d

# Run migrations against the prod DB:
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Verify all 3 replicas respond:
for i in 1 2 3; do curl -s http://localhost/api/v1/health | jq .status; done
```

Expected: `"ok"` printed 3 times (requests routed to different replicas by Nginx).

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker/ docker-compose.prod.yml .dockerignore
git commit -m "feat(sprint-6): multi-stage Dockerfile and Nginx load balancer config"
```

---

### Task 13: k6 stress test + documentation

**Files:**
- Create: `k6/stress-test.js`
- Modify: `README.md`

- [ ] **Step 1: Install k6**

macOS: `brew install k6`
Or download from https://k6.io/docs/getting-started/installation/

- [ ] **Step 2: Create k6 stress test script**

```javascript
// k6/stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = 'http://localhost/api/v1';

export function setup() {
  const res = http.post(
    `${BASE}/auth/register`,
    JSON.stringify({ email: `k6_${Date.now()}@test.com`, name: 'K6 User', password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.json('accessToken') };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Health check
  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  // List matches (public)
  const matches = http.get(`${BASE}/matches`);
  check(matches, { 'matches 200': (r) => r.status === 200 });

  // List own rooms (authenticated)
  const rooms = http.get(`${BASE}/rooms`, { headers });
  check(rooms, { 'rooms 200': (r) => r.status === 200 });

  sleep(1);
}
```

- [ ] **Step 3: Run stress test against 3-replica stack**

```bash
# Make sure docker-compose.prod.yml stack is up with 3 replicas
k6 run k6/stress-test.js
```

Expected output (record in test docs):
- `http_req_duration p(95)` < 500ms
- `http_req_failed rate` < 1%
- Total requests, RPS

- [ ] **Step 4: Update README.md with deployment instructions**

```markdown
## Running Locally (Development)

```bash
cp .env.example .env  # fill real values
docker compose up
```

App: http://localhost:3000/api/v1/health  
Swagger: http://localhost:3000/api/docs

## Running in Production (with load balancing)

```bash
cp .env.example .env  # fill production values
docker compose -f docker-compose.prod.yml up --build --scale app=3 -d
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

Nginx routes round-robin across 3 app replicas on port 80.

## Stress Testing

```bash
brew install k6
docker compose -f docker-compose.prod.yml up --scale app=3 -d
k6 run k6/stress-test.js
```

## Running Tests

```bash
npm test           # unit tests
npm run test:cov   # with coverage
```
```

- [ ] **Step 5: Run full test suite one last time**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add k6/ README.md
git commit -m "feat(sprint-6): k6 stress test and deployment documentation"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Auth: email/password + Google OAuth → Tasks 4–5
- [x] JWT access + refresh token rotation → Task 4
- [x] Profile edit (name/avatar, no role) → Task 5
- [x] Rooms CRUD + invite codes + membership → Tasks 6–7
- [x] Matches admin CRUD + result entry → Task 8
- [x] EventEmitter trigger on match.finished → Task 8
- [x] Predictions with timing validation → Task 9
- [x] isEarlyBonus computed at submit time → Task 9
- [x] Scoring engine: exact(5), winner(3), diff(2) → Task 10
- [x] Streak bonus: +2 per 3 consecutive → Task 10
- [x] Early bonus: +1 stacked on top → Task 11
- [x] Leaderboard on-the-fly aggregation → Task 11
- [x] Rate limiting (ThrottlerModule) → Task 3
- [x] Swagger docs → Task 3
- [x] Global exception filter + error format → Task 3
- [x] Multi-stage Dockerfile → Task 12
- [x] Nginx + 3 replicas → Task 12
- [x] Stress test → Task 13
- [x] ADMIN role guard on match endpoints → Task 8
- [x] MatchStage enum: GROUP/ROUND_OF_16/QUARTER_FINAL/SEMI_FINAL/FINAL → Task 2
