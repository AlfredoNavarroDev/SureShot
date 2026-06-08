import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStage } from '@prisma/client';

export class CreateMatchDto {
  @ApiProperty({ example: 'Argentina' })
  @IsString()
  homeTeam: string;

  @ApiProperty({ example: 'France' })
  @IsString()
  awayTeam: string;

  @ApiProperty({ example: '2026-06-15T18:00:00Z' })
  @IsDateString()
  matchDatetime: string;

  @ApiProperty({ enum: MatchStage })
  @IsEnum(MatchStage)
  stage: MatchStage;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  group?: string;
}
