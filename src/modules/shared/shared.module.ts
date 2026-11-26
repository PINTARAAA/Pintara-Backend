import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { NotificationsService } from './notifications.service';
import { SettingsService } from './settings.service';

@Global()
@Module({
  providers: [AccessService, NotificationsService, SettingsService],
  exports: [AccessService, NotificationsService, SettingsService],
})
export class SharedModule {}
