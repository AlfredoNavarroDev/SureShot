import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('leaderboard')
@ApiBearerAuth()
@Controller('rooms/:roomId/leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@Param('roomId') roomId: string, @CurrentUser() user: any) {
    return this.leaderboardService.getLeaderboard(roomId, user.id);
  }
}
