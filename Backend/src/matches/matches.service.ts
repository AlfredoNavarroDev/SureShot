import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Match, MatchStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchResultEvent } from './events/match-result.event';

@Injectable()
export class MatchesService {
  private allMatchesCache: { data: Match[]; expires: number } | null = null;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateMatchDto) {
    this.allMatchesCache = null;
    return this.prisma.match.create({ data: { ...dto } });
  }

  async findAll(status?: MatchStatus, stage?: string) {
    if (!status && !stage) {
      if (this.allMatchesCache && Date.now() < this.allMatchesCache.expires) {
        return this.allMatchesCache.data;
      }
      const data = await this.prisma.match.findMany({
        orderBy: { matchDatetime: 'asc' },
      });
      this.allMatchesCache = { data, expires: Date.now() + this.CACHE_TTL_MS };
      return data;
    }
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
    this.allMatchesCache = null;
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

  async remove(id: string) {
    this.allMatchesCache = null;
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');
    await this.prisma.match.delete({ where: { id } });
  }
}
