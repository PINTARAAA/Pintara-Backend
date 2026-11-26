import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
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
  AccountInputDto,
  ChangeDecisionDto,
  DeclineOfferDto,
  LinkStudentsDto,
  ManualPaymentDto,
  MonthDto,
  ObjectionReviewDto,
  PayHonorDto,
  RejectRegistrationDto,
  ReportDto,
  ResendAllDto,
  SaveScheduleDto,
  SelectTutorDto,
  SendOfferDto,
  SettingInputDto,
  StatusDto,
  TutorInputDto,
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

  // ---------- Data Master · Tutor & Siswa ----------

  @Get('tutor')
  tutors(
    @Query('query') query?: string,
    @Query('subject') subject?: string,
    @Query('district') district?: string,
    @Query('status') status?: string,
  ) {
    return this.pengelola.tutors({ query, subject, district, status });
  }

  @Post('tutor')
  createTutor(@Body() dto: TutorInputDto) {
    return this.pengelola.createTutor(dto);
  }

  @Get('tutor/:id')
  tutor(@Param('id') id: string) {
    return this.pengelola.tutor(id);
  }

  @Put('tutor/:id')
  updateTutor(@Param('id') id: string, @Body() dto: TutorInputDto) {
    return this.pengelola.updateTutor(id, dto);
  }

  @Patch('tutor/:id/status')
  setTutorStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.pengelola.setTutorStatus(id, dto.status);
  }

  @Get('siswa')
  students(
    @Query('query') query?: string,
    @Query('subject') subject?: string,
    @Query('district') district?: string,
    @Query('status') status?: string,
  ) {
    return this.pengelola.students({ query, subject, district, status });
  }

  @Get('siswa/:id')
  student(@Param('id') id: string) {
    return this.pengelola.student(id);
  }

  @Patch('siswa/:id/status')
  setStudentStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.pengelola.setStudentStatus(id, dto.status);
  }

  // ---------- Manajemen Akun ----------

  @Get('akun/siswa')
  linkableStudents() {
    return this.pengelola.linkableStudents();
  }

  @Get('akun')
  accounts(@Query('peran') role?: string, @Query('q') query?: string) {
    return this.pengelola.accounts({ role, query });
  }

  @Post('akun')
  createAccount(@Body() dto: AccountInputDto) {
    return this.pengelola.createAccount(dto);
  }

  @Get('akun/:id')
  account(@Param('id') id: string) {
    return this.pengelola.account(id);
  }

  @Put('akun/:id')
  updateAccount(@Param('id') id: string, @Body() dto: AccountInputDto) {
    return this.pengelola.updateAccount(id, dto);
  }

  @Post('akun/:id/reset-password')
  @HttpCode(200)
  resetAccountPassword(@Param('id') id: string) {
    return this.pengelola.resetAccountPassword(id);
  }

  @Patch('akun/:id/status')
  setAccountStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.pengelola.setAccountStatus(id, dto.status);
  }

  @Put('akun/:id/siswa')
  linkStudents(@Param('id') id: string, @Body() dto: LinkStudentsDto) {
    return this.pengelola.linkStudents(id, dto);
  }

  // ---------- Rekap & Riwayat Les ----------

  @Get('riwayat-les')
  lessonRecap(
    @Query('bulan') month?: string,
    @Query('tutorId') tutorId?: string,
    @Query('siswaId') studentId?: string,
  ) {
    return this.pengelola.lessonRecap({ month, tutorId, studentId });
  }

  // ---------- Laporan Keuangan ----------

  @Get('laporan-keuangan')
  financeSummary(@Query('bulan') month?: string) {
    return this.pengelola.financeSummary(month);
  }

  @Post('laporan-keuangan/unduh')
  @HttpCode(200)
  generateReport(@CurrentUser() user: AuthUser, @Body() dto: ReportDto) {
    return this.pengelola.generateReport(user.id, dto);
  }

  @Get('tagihan')
  studentBills(@Query('bulan') month?: string) {
    return this.pengelola.studentBills(month);
  }

  @Get('tagihan/:id')
  studentBill(@Param('id') id: string) {
    return this.pengelola.studentBill(id);
  }

  @Post('tagihan/:id/pembayaran')
  @HttpCode(200)
  manualPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ManualPaymentDto,
  ) {
    return this.pengelola.recordManualPayment(user.id, id, dto);
  }

  // ---------- Pengaturan Notifikasi ----------

  @Get('pengaturan-notifikasi')
  notificationSettings() {
    return this.pengelola.notificationSettings();
  }

  @Get('pengaturan-notifikasi/:id')
  notificationSetting(@Param('id') id: string) {
    return this.pengelola.notificationSetting(id);
  }

  @Put('pengaturan-notifikasi/:id')
  saveNotificationSetting(
    @Param('id') id: string,
    @Body() dto: SettingInputDto,
  ) {
    return this.pengelola.saveNotificationSetting(id, dto);
  }

  // ---------- Riwayat Notifikasi ----------

  @Get('riwayat-notifikasi')
  notificationLogs(
    @Query('status') status?: string,
    @Query('jenis') jenis?: string,
    @Query('periode') periode?: string,
  ) {
    return this.pengelola.notificationLogs({ status, kind: jenis, period: periode });
  }

  @Post('riwayat-notifikasi/kirim-ulang')
  @HttpCode(200)
  resendAllNotifications(@Body() dto: ResendAllDto) {
    return this.pengelola.resendAllNotifications(dto);
  }

  @Get('riwayat-notifikasi/:id')
  notificationLog(@Param('id') id: string) {
    return this.pengelola.notificationLog(id);
  }

  @Post('riwayat-notifikasi/:id/kirim-ulang')
  @HttpCode(200)
  resendNotification(@Param('id') id: string) {
    return this.pengelola.resendNotification(id);
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
