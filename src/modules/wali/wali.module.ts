import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { WaliController } from './wali.controller';
import { WaliService } from './wali.service';

@Module({
  imports: [SharedModule],
  controllers: [WaliController],
  providers: [WaliService],
})
export class WaliModule {}
