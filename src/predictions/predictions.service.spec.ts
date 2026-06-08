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
  matchDatetime: new Date(Date.now() + 48 * 60 * 60 * 1000),
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
      const soon = new Date(Date.now() + 5 * 60 * 1000);
      prisma.match.findUnique.mockResolvedValue(makeMatch({ matchDatetime: soon }));
      await expect(
        service.create(userId, roomId, { matchId, homeScore: 2, awayScore: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets isEarlyBonus true when prediction submitted > 24h before match', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.match.findUnique.mockResolvedValue(makeMatch());
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
