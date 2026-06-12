import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';

type LeaderboardEntry = {
  user: { id: string; name: string; avatar: string | null };
  totalPoints: number;
  basePoints: number;
  earlyBonuses: number;
  streakBonus: number;
  predictionsCount: number;
};

type CacheEntry = {
  memberIds: Set<string>;
  data: LeaderboardEntry[];
  expires: number;
};

@Injectable()
export class LeaderboardService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<CacheEntry>>();
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private prisma: PrismaService,
    private scoring: ScoringService,
  ) {}

  invalidate(roomId: string) {
    this.cache.delete(roomId);
  }

  @OnEvent('match.finished')
  onMatchFinished() {
    this.cache.clear();
  }

  async getLeaderboard(roomId: string, requesterId: string) {
    const cached = this.cache.get(roomId);
    if (cached && Date.now() < cached.expires && cached.memberIds.has(requesterId)) {
      return cached.data;
    }

    // Auth check — single indexed PK lookup, cheap
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: requesterId } },
    });
    if (!membership) {
      const roomExists = (await this.prisma.room.count({ where: { id: roomId } })) > 0;
      if (!roomExists) throw new NotFoundException('Room not found');
      throw new ForbiddenException('Not a member of this room');
    }

    // Re-check cache: another concurrent request may have populated it while we awaited auth
    const cachedAfterAuth = this.cache.get(roomId);
    if (cachedAfterAuth && Date.now() < cachedAfterAuth.expires) {
      cachedAfterAuth.memberIds.add(requesterId);
      return cachedAfterAuth.data;
    }

    // Single-flight: coalesce all concurrent cache-miss fetches into one DB round-trip
    let fetching = this.inflight.get(roomId);
    if (!fetching) {
      fetching = this.fetchAndCache(roomId);
      this.inflight.set(roomId, fetching);
      fetching.finally(() => this.inflight.delete(roomId));
    }
    const entry = await fetching;
    entry.memberIds.add(requesterId);
    return entry.data;
  }

  private async fetchAndCache(roomId: string): Promise<CacheEntry> {
    const [members, allPredictions] = await Promise.all([
      this.prisma.roomMember.findMany({
        where: { roomId },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      }),
      this.prisma.prediction.findMany({
        where: { roomId, match: { status: MatchStatus.FINISHED } },
        include: { match: true },
        orderBy: { match: { matchDatetime: 'asc' } },
      }),
    ]);

    const predsByUser = new Map<string, typeof allPredictions>();
    for (const p of allPredictions) {
      const arr = predsByUser.get(p.userId) ?? [];
      arr.push(p);
      predsByUser.set(p.userId, arr);
    }

    const rankings = members.map((member) => {
      const predictions = predsByUser.get(member.userId) ?? [];
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
    });

    const data = rankings.sort((a, b) => b.totalPoints - a.totalPoints);
    const entry: CacheEntry = {
      memberIds: new Set(members.map((m) => m.userId)),
      data,
      expires: Date.now() + this.CACHE_TTL_MS,
    };
    this.cache.set(roomId, entry);
    return entry;
  }
}
