import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PredictionsService } from './predictions.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('predictions')
@ApiBearerAuth()
@Controller('rooms/:roomId/predictions')
export class PredictionsController {
  constructor(private predictionsService: PredictionsService) {}

  @Post()
  create(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: CreatePredictionDto,
  ) {
    return this.predictionsService.create(user.id, roomId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Param('roomId') roomId: string) {
    return this.predictionsService.findAllInRoom(user.id, roomId);
  }

  @Get(':matchId')
  findOne(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.predictionsService.findOne(user.id, roomId, matchId);
  }

  @Patch(':matchId')
  update(
    @CurrentUser() user: any,
    @Param('roomId') roomId: string,
    @Param('matchId') matchId: string,
    @Body() dto: Partial<CreatePredictionDto>,
  ) {
    return this.predictionsService.update(user.id, roomId, matchId, dto);
  }
}
