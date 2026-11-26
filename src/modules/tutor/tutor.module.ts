import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { SharedModule } from '../shared/shared.module';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [SharedModule, StorageModule],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
