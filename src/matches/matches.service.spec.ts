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
