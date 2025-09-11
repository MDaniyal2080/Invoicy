import { Controller, Get, Query, Sse } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // Server-Sent Events stream: client must pass a JWT token (same as API token)
  @Sse('stream')
  stream(@Query('token') token?: string): Observable<MessageEvent> {
    const payload = this.notifications.verifyToken(token);
    const userId = payload?.sub;
    return this.notifications.stream(userId);
  }
}
