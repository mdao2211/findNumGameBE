import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('roomplayer')
export class RoomPlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'room_id' })
  roomId: string;

  @Column('uuid', { name: 'player_id' })
  playerId: string;

  @Column({ type: 'boolean', name: 'is_ready', default: false })
  isReady: boolean;

  @Column({ type: 'boolean', name: 'is_host', default: false })
  isHost: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinAt: Date;
}
