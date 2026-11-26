import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { WaliService } from './wali.service';
import {
  ObjectionDto,
  PayBillDto,
  PendaftaranDto,
  ReviewDto,
  SubmitChangeDto,
} from './wali.dto';

@Roles('wali')
@Controller('wali')
export class WaliController {
  constructor(private readonly wali: WaliService) {}

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: AuthUser,
    @Query('siswa') studentId?: string,
  ) {
    return this.wali.dashboard(user.id, studentId);
  }

  @Get('profil')
  profile(@CurrentUser() user: AuthUser) {
    return this.wali.profile(user.id);
  }

  @Get('akun')
  account(@CurrentUser() user: AuthUser) {
    return this.wali.account(user.id);
  }

  @Get('pendaftaran/defaults')
  registrationDefaults(@CurrentUser() user: AuthUser) {
    return this.wali.registrationDefaults(user.id);
  }

  @Post('pendaftaran')
  @HttpCode(200)
  submitRegistration(
    @CurrentUser() user: AuthUser,
    @Body() dto: PendaftaranDto,
  ) {
    return this.wali.submitRegistration(user.id, dto);
  }

  @Get('pendaftaran/terbaru')
  latestRegistration(@CurrentUser() user: AuthUser) {
    return this.wali.registrationStatus(user.id);
  }

  @Get('pendaftaran/:id')
  registrationStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.wali.registrationStatus(user.id, id);
  }

  @Get('jadwal')
  schedule(
    @CurrentUser() user: AuthUser,
    @Query('siswa') studentId?: string,
  ) {
    return this.wali.schedule(user.id, studentId);
  }

  @Get('jadwal/rutin/:id')
  routine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.routine(user, id);
  }

  // Alias sesuai kontrak frontend: getRoutine(id) -> GET /wali/jadwal/:id
  @Get('jadwal/:id')
  routineAlias(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.routine(user, id);
  }

  @Post('pengajuan-jadwal')
  @HttpCode(200)
  submitChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitChangeDto,
  ) {
    return this.wali.submitChange(user, dto);
  }

  @Get('pengajuan-jadwal/:id')
  changeRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.changeRequest(user, id);
  }

  @Get('presensi')
  attendance(
    @CurrentUser() user: AuthUser,
    @Query('siswa') studentId?: string,
  ) {
    return this.wali.attendance(user.id, studentId);
  }

  @Get('presensi/:id')
  session(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.session(user, id);
  }

  @Post('presensi/:id/setujui')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.approveSession(user, id);
  }

  @Post('presensi/:id/keberatan')
  @HttpCode(200)
  objection(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ObjectionDto,
  ) {
    return this.wali.objection(user, id, dto);
  }

  @Post('presensi/:id/ulasan')
  @HttpCode(200)
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.wali.reviewSession(user, id, dto);
  }

  @Get('riwayat-les')
  lessonHistory(
    @CurrentUser() user: AuthUser,
    @Query('siswa') studentId?: string,
    @Query('bulan') month?: string,
  ) {
    return this.wali.lessonHistory(user.id, studentId, month);
  }

  @Get('tagihan')
  bills(@CurrentUser() user: AuthUser) {
    return this.wali.bills(user.id);
  }

  @Get('tagihan/:id')
  bill(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.bill(user.id, id);
  }

  @Post('tagihan/:id/pembayaran')
  @HttpCode(200)
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PayBillDto,
  ) {
    return this.wali.createPayment(user.id, id, dto);
  }

  // Alias sesuai kontrak frontend: createPayment -> POST /wali/tagihan/:id/bayar
  @Post('tagihan/:id/bayar')
  @HttpCode(200)
  payAlias(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PayBillDto,
  ) {
    return this.wali.createPayment(user.id, id, dto);
  }

  @Get('pembayaran')
  payments(@CurrentUser() user: AuthUser) {
    return this.wali.payments(user.id);
  }

  @Get('pembayaran/:trxId')
  paymentResult(
    @CurrentUser() user: AuthUser,
    @Param('trxId') trxId: string,
  ) {
    return this.wali.paymentResult(user.id, trxId);
  }

  @Get('notifikasi')
  notifications(@CurrentUser() user: AuthUser) {
    return this.wali.listNotifications(user.id);
  }

  @Post('notifikasi/:id/read')
  @HttpCode(200)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.markRead(user.id, id);
  }

  @Post('notifikasi/read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.wali.markAllRead(user.id);
  }

  @Post('notifikasi/:id/dibaca')
  @HttpCode(200)
  markReadAlias(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.wali.markRead(user.id, id);
  }

  @Post('notifikasi/dibaca-semua')
  @HttpCode(200)
  markAllReadAlias(@CurrentUser() user: AuthUser) {
    return this.wali.markAllRead(user.id);
  }
}
