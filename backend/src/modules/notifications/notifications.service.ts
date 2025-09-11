import {
  Injectable,
  UnauthorizedException,
  MessageEvent,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export type AppEvent = {
  userId?: string; // owner user id (for scoping)
  type: string; // e.g., invoice.sent, payment.processed
  payload?: any;
  ts: string; // ISO timestamp
};

@Injectable()
export class NotificationsService {
  private subject = new Subject<AppEvent>();

  constructor(private readonly jwtService: JwtService) {}

  emit(userId: string | undefined, type: string, payload?: any) {
    const evt: AppEvent = {
      userId,
      type,
      payload,
      ts: new Date().toISOString(),
    };
    this.subject.next(evt);
  }

  stream(userId?: string): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      filter((e) => !userId || e.userId === userId),
      map((e) => ({ data: e }) as MessageEvent),
    );
  }

  verifyToken(token?: string): { sub: string } {
    if (!token) throw new UnauthorizedException('Missing token');
    try {
      return this.jwtService.verify(token);
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
