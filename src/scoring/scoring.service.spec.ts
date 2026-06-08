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
      expect(service.computeBasePoints(pred(3, 2), match(2, 1))).toBe(5);
    });

    it('returns 0 for wrong winner', () => {
      expect(service.computeBasePoints(pred(0, 2), match(2, 1))).toBe(0);
    });

    it('returns 3 for correct draw (different scores)', () => {
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
      expect(service.computeStreakBonus([3, 3, 0, 3, 3, 3])).toBe(2);
    });

    it('returns 0 for all wrong', () => {
      expect(service.computeStreakBonus([0, 0, 0, 0])).toBe(0);
    });

    it('returns 0 for goal-diff-only predictions (2 points < 3 threshold)', () => {
      expect(service.computeStreakBonus([2, 2, 2])).toBe(0);
    });
  });
});
