import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  @OnEvent('match.updated')
  handleMatchUpdated(payload: { matchId: string }) {
    this.server.emit('match:updated', payload);
  }

  @OnEvent('match.finished')
  handleMatchFinished(payload: { matchId: string }) {
    this.server.emit('leaderboard:updated', payload);
  }

  @OnEvent('prediction.saved')
  handlePredictionSaved(payload: { roomId: string }) {
    this.server.emit('prediction:saved', payload);
  }

  @OnEvent('room.member.updated')
  handleMemberUpdated(payload: { roomId: string }) {
    this.server.emit('member:updated', payload);
  }
}
