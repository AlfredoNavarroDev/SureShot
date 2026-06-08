import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.roomsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.findOne(id, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.remove(id, user.id);
  }

  @Post('join')
  @HttpCode(200)
  join(@CurrentUser() user: any, @Body() dto: JoinRoomDto) {
    return this.roomsService.join(user.id, dto.inviteCode);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.getMembers(id, user.id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  kickMember(
    @Param('id') roomId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.roomsService.kickMember(roomId, targetUserId, user.id);
  }

  @Post(':id/invites')
  rotateInviteCode(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roomsService.rotateInviteCode(id, user.id);
  }
}
