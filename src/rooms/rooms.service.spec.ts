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
