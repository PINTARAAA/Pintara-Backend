import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { PengelolaService } from './pengelola.service';
import {
  ChangeDecisionDto,
  DeclineOfferDto,
  MonthDto,
  ObjectionReviewDto,
  PayHonorDto,
  RejectRegistrationDto,
  SaveScheduleDto,
  SelectTutorDto,
  SendOfferDto,
} from './pengelola.dto';

@Roles('pengelola')
@Controller('pengelola')
export class PengelolaController {
  constructor(private readonly pengelola: PengelolaService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.pengelola.dashboard(user.id);
  }

  @Get('lainnya')
  menu(@CurrentUser() user: AuthUser) {
    return this.pengelola.menu(user.id);
  }

  @Get('pendaftaran')
  registrations(
    @Query('status') status?: string,
    @Query('q') query?: string,
    @Query('level') level?: string,
  ) {
    return this.pengelola.registrations({ status, query, level });
  }

  @Get('pendaftaran/:id')
  registration(@Param('id') id: string) {
    return this.pengelola.registration(id);
  }

  @Post('pendaftaran/:id/verifikasi')
  @HttpCode(200)
  verify(@Param('id') id: string) {
    return this.pengelola.verifyRegistration(id);
  }

  @Post('pendaftaran/:id/tolak')
  @HttpCode(200)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.pengelola.rejectRegistration(id, dto);
  }

  @Get('pencocokan')
  matchingQueue() {
    return this.pengelola.matchingQueue();
  }

  @Get('pencocokan/:id')
  matchingCandidates(@Param('id') id: string) {
    return this.pengelola.matchingCandidates(id);
  }

  @Post('pencocokan/:id')
  @HttpCode(200)
  selectTutor(@Param('id') id: string, @Body() dto: SelectTutorDto) {
    return this.pengelola.selectTutor(id, dto.tutorId);
  }

  @Get('penawaran')
  offers() {
    return this.pengelola.offers();
  }

  @Get('penawaran/draf/:registrationId')
  offerDraft(@Param('registrationId') registrationId: string) {
    return this.pengelola.offerDraft(registrationId);
  }

  @Post('penawaran')
  @HttpCode(200)
  sendOffer(@Body() dto: SendOfferDto) {
    return this.pengelola.sendOffer(dto);
  }

  @Get('penawaran/:id')
  offer(@Param('id') id: string) {
    return this.pengelola.offer(id);
  }

  @Post('penawaran/:id/diterima')
  @HttpCode(200)
  acceptOffer(@Param('id') id: string) {
    return this.pengelola.acceptOffer(id);
  }

  @Post('penawaran/:id/ditolak')
  @HttpCode(200)
  declineOffer(@Param('id') id: string, @Body() dto: DeclineOfferDto) {
    return this.pengelola.declineOffer(id, dto);
  }

  @Get('jadwal')
  scheduleBoard() {
    return this.pengelola.scheduleBoard();
  }

  @Get('jadwal/draf/:offerId')
  scheduleDraft(@Param('offerId') offerId: string) {
    return this.pengelola.scheduleDraft(offerId);
  }

  @Get('jadwal/:pairId')
  pairDraft(@Param('pairId') pairId: string) {
    return this.pengelola.pairDraft(pairId);
  }

  @Put('jadwal')
  saveSchedule(@Body() dto: SaveScheduleDto) {
    return this.pengelola.saveSchedule(dto);
  }

  @Get('pengajuan-jadwal/:id')
  changeReview(@Param('id') id: string) {
    return this.pengelola.changeReview(id);
  }

  @Post('pengajuan-jadwal/:id')
  @HttpCode(200)
  decideChange(@Param('id') id: string, @Body() dto: ChangeDecisionDto) {
    return this.pengelola.decideChange(id, dto);
  }

  @Get('presensi')
  attendanceOverview(@Query('bulan') month?: string) {
    return this.pengelola.attendanceOverview(month);
  }

  @Post('presensi/final')
  @HttpCode(200)
  finalize(@Body() dto: MonthDto) {
    return this.pengelola.finalizeAttendance(dto.bulan);
  }

  @Get('presensi/:id/keberatan')
  objection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.pengelola.objection(user.id, id);
  }

  @Post('presensi/:id/keberatan')
  @HttpCode(200)
  reviewObjection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ObjectionReviewDto,
  ) {
    return this.pengelola.reviewObjection(user.id, id, dto);
  }

  @Get('honor')
  honorRecap(@Query('bulan') month?: string) {
    return this.pengelola.honorRecap(month);
  }

  @Post('honor/hitung')
  @HttpCode(200)
  calculateHonor(@Body() dto: MonthDto) {
    return this.pengelola.calculateHonor(dto.bulan);
  }

  @Get('honor/:bulan/:tutorId')
  honorDetail(
    @Param('bulan') month: string,
    @Param('tutorId') tutorId: string,
  ) {
    return this.pengelola.honorDetail(month, tutorId);
  }

  @Post('honor/:bulan/:tutorId/bayar')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('proof'))
  payHonor(
    @CurrentUser() user: AuthUser,
    @Param('bulan') month: string,
    @Param('tutorId') tutorId: string,
    @Body() dto: PayHonorDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.pengelola.recordHonorPayment(
      user.id,
      month,
      tutorId,
      dto,
      file,
    );
  }

  @Get('notifikasi')
  notifications(@CurrentUser() user: AuthUser) {
    return this.pengelola.listNotifications(user.id);
  }

  @Post('notifikasi/:id/dibaca')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pengelola.markRead(user.id, id);
  }

  @Post('notifikasi/dibaca-semua')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.pengelola.markAllRead(user.id);
  }

  @Post('notifikasi/:id/read')
  @HttpCode(200)
  markReadAlias(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pengelola.markRead(user.id, id);
  }

  @Post('notifikasi/read-all')
  @HttpCode(200)
  markAllReadAlias(@CurrentUser() user: AuthUser) {
    return this.pengelola.markAllRead(user.id);
  }
}
