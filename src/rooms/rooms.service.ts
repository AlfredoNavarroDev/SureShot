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
