export class RoomPlayerResponseDto {
  id: string;
  roomId: string;
  playerId: string;
  isReady: boolean;
  isHost: boolean;
  joinedAt: Date;
}
