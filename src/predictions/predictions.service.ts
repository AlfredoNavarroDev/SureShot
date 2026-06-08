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

    return this.prisma.prediction.create({
      data: {
        userId,
        roomId,
        matchId: dto.matchId,
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        isEarlyBonus,
      },
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

    return this.prisma.prediction.update({
      where: { userId_matchId_roomId: { userId, matchId, roomId } },
      data: {
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        isEarlyBonus,
      },
    });
  }

  private assertNotLocked(matchDatetime: Date) {
    const lockTime = new Date(matchDatetime.getTime() - 10 * 60 * 1000);
    if (new Date() >= lockTime) {
      throw new BadRequestException('Predictions are locked for this match');
    }
  }
}
