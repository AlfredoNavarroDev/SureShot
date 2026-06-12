import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';
import * as os from 'os';

@ApiTags('health')
@Controller()
export class AppController {
  @SkipThrottle()
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', instance: os.hostname(), timestamp: new Date().toISOString() };
  }
}
