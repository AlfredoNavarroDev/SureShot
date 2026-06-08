import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'Mundial 2026 - Amigos' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  name: string;
}
