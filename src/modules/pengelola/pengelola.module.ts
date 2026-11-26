import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { SharedModule } from '../shared/shared.module';
import { PengelolaController } from './pengelola.controller';
import { PengelolaService } from './pengelola.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [SharedModule, StorageModule],
  controllers: [PengelolaController],
  providers: [PengelolaService, ReportsService],
})
export class PengelolaModule {}