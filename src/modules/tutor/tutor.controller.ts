import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { TutorService } from './tutor.service';
import { AttendanceDto, TutorChangeDto } from './tutor.dto';

@Roles('tutor')
@Controller('tutor')
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.tutor.dashboard(user.id);
  }

  @Get('akun')
  account(@CurrentUser() user: AuthUser) {
    return this.tutor.account(user.id);
  }

  @Get('presensi')
  sessions(@CurrentUser() user: AuthUser) {
    return this.tutor.sessions(user.id);
  }

  @Get('presensi/status')
  status(
    @CurrentUser() user: AuthUser,
    @Query('bulan') month?: string,
  ) {
    return this.tutor.status(user.id, month);
  }

  @Get('presensi/:id')
  session(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tutor.session(user.id, id);
  }

  @Post('presensi/:id')
  @HttpCode(200)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AttendanceDto,
  ) {
    return this.tutor.submitAttendance(user.id, id, dto);
  }

  @Post('dokumentasi')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tutor.uploadDocumentation(user.id, file);
  }

  @Get('riwayat')
  history(
    @CurrentUser() user: AuthUser,
    @Query('bulan') month?: string,
    @Query('siswa') student?: string,
  ) {
    return this.tutor.history(user.id, month, student);
  }

  @Get('jadwal')
  schedule(
    @CurrentUser() user: AuthUser,
    @Query('minggu') week?: string,
  ) {
    return this.tutor.schedule(user.id, Number(week ?? 0));
  }

  @Get('jadwal/:id')
  scheduleSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tutor.scheduleSession(user.id, id);
  }

  @Post('pengajuan-jadwal')
  @HttpCode(200)
  submitChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: TutorChangeDto,
  ) {
    return this.tutor.submitChange(user.id, dto);
  }

  @Get('notifikasi')
  notifications(@CurrentUser() user: AuthUser) {
    return this.tutor.listNotifications(user.id);
  }

  @Post('notifikasi/:id/dibaca')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tutor.markRead(user.id, id);
  }

  @Post('notifikasi/dibaca-semua')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.tutor.markAllRead(user.id);
  }

  @Post('notifikasi/:id/read')
  @HttpCode(200)
  markReadAlias(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tutor.markRead(user.id, id);
  }

  @Post('notifikasi/read-all')
  @HttpCode(200)
  markAllReadAlias(@CurrentUser() user: AuthUser) {
    return this.tutor.markAllRead(user.id);
  }
}
