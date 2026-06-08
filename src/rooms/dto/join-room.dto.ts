import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinRoomDto {
  @ApiProperty({ example: 'abc12345' })
  @IsString()
  @Length(8, 8)
  inviteCode: string;
}
