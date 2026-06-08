import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private prisma: PrismaService,
    private scoring: ScoringService,
  ) {}

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
          where: {
            userId: member.userId,
            roomId,
            match: { status: MatchStatus.FINISHED },
          },
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
