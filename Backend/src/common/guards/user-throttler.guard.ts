import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { id?: string } | undefined;
    if (user?.id) return user.id;

    const headers = req['headers'] as Record<string, string> | undefined;
    const auth = headers?.['authorization'];
    if (auth?.startsWith('Bearer ')) return auth.slice(7);

    return req['ip'] as string;
  }

  protected getRequestResponse(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    return { req, res };
  }
}
