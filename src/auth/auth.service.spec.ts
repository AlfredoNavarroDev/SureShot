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
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
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
    jwt = {
      sign: jest.fn().mockReturnValue('token_value'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test_secret_32_chars_long_xxxxx'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const res = { cookie: jest.fn() } as any;
      await expect(
        service.register(
          { email: 'test@example.com', name: 'Test', password: 'pass1234' },
          res,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password before storing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...mockUser });
      prisma.user.update.mockResolvedValue({ ...mockUser });
      const res = { cookie: jest.fn() } as any;

      await service.register(
        { email: 'new@example.com', name: 'New', password: 'pass1234' },
        res,
      );

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe('pass1234');
      const isHashed = await bcrypt.compare(
        'pass1234',
        createCall.data.password,
      );
      expect(isHashed).toBe(true);
    });

    it('returns accessToken on successful registration', async () => {
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
        service.login(
          { email: 'nobody@example.com', password: 'pass1234' },
          res,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct_pass', 12);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hash });
      const res = { cookie: jest.fn() } as any;
      await expect(
        service.login(
          { email: 'test@example.com', password: 'wrong_pass' },
          res,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns accessToken on valid credentials', async () => {
      const hash = await bcrypt.hash('pass1234', 12);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hash });
      prisma.user.update.mockResolvedValue({ ...mockUser });
      const res = { cookie: jest.fn() } as any;

      const result = await service.login(
        { email: 'test@example.com', password: 'pass1234' },
        res,
      );
      expect(result).toHaveProperty('accessToken');
    });
  });
});
