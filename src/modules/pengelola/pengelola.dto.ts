import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RejectRegistrationDto {
  @IsString() @MinLength(1) reason!: string;
  @IsString() @MinLength(1) message!: string;
}

export class SelectTutorDto {
  @IsString() @MinLength(1) tutorId!: string;
}

export class SendOfferDto {
  @IsString() @MinLength(1) registrationId!: string;
  @IsString() @IsOptional() message?: string;
}

export class DeclineOfferDto {
  @IsString() @MinLength(1) reason!: string;
  @IsString() @IsOptional() note?: string;
}

export class ScheduleSessionDto {
  @IsString() @MinLength(1) subject!: string;
  @IsString() @MinLength(1) day!: string;
  @IsString() @MinLength(1) start!: string;
  @IsString() @MinLength(1) end!: string;
}

export class SaveScheduleDto {
  @IsObject() draft!: Record<string, any>;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ScheduleSessionDto)
  sessions!: ScheduleSessionDto[];
  @IsString() @MinLength(1) effectiveFrom!: string;
}

export class ChangeDecisionDto {
  @IsBoolean() approved!: boolean;
}

export class ObjectionReviewDto {
  @IsBoolean() corrected!: boolean;
  @IsString() @IsOptional() actualStart?: string;
  @IsString() @IsOptional() actualEnd?: string;
  @IsString() @IsOptional() note?: string;
}

export class MonthDto {
  @IsString() @IsOptional() bulan?: string;
}

export class PayHonorDto {
  @IsString() @MinLength(1) method!: string;
  @IsString() @MinLength(1) paidAt!: string;
  @Type(() => Number) @IsNumber() @Min(1) amount!: number;
}

export class StatusDto {
  @IsIn(['aktif', 'nonaktif']) status!: 'aktif' | 'nonaktif';
}

export class TutorInputDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() education?: string;
  @IsArray() @IsString({ each: true }) subjects!: string[];
  @IsArray() @IsString({ each: true }) levels!: string[];
  @IsArray() @IsString({ each: true }) days!: string[];
  @IsString() @MinLength(1) from!: string;
  @IsString() @MinLength(1) until!: string;
  @IsString() @IsOptional() address?: string;
  @Type(() => Number) @IsNumber() @Min(0) rate!: number;
}

export class AccountInputDto {
  @IsIn(['wali', 'tutor', 'pengelola']) role!: 'wali' | 'tutor' | 'pengelola';
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) email!: string;
  @IsString() @MinLength(1) username!: string;
  @IsString() @IsOptional() phone?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() studentIds?: string[];
}

export class LinkStudentsDto {
  @IsArray() @IsString({ each: true }) siswaIds!: string[];
}

export class ManualPaymentDto {
  @Type(() => Number) @IsNumber() @Min(1) amount!: number;
  @IsString() @MinLength(1) paidAt!: string;
  @IsIn(['Tunai di LBB', 'Transfer bank']) method!: string;
  @IsOptional() @IsObject() proof?: { name?: string; size?: number };
}

export class ReportDto {
  @IsString() @MinLength(1) month!: string;
  @IsIn(['ringkasan', 'tagihan', 'honor', 'lengkap']) type!:
    | 'ringkasan'
    | 'tagihan'
    | 'honor'
    | 'lengkap';
  @IsIn(['pdf', 'xlsx']) format!: 'pdf' | 'xlsx';
}

export class SettingInputDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['whatsapp', 'email', 'aplikasi']) channel?: string;
  @IsOptional() @IsObject() timing?: Record<string, any>;
  @IsOptional() @IsString() @MaxLength(500) template?: string;
}

export class ResendAllDto {
  @IsOptional() @IsIn(['terkirim', 'gagal']) status?: 'terkirim' | 'gagal';
  @IsOptional() @IsString() jenis?: string;
  @IsOptional()
  @IsIn(['hari-ini', '7-hari', 'bulan-ini', 'bulan-lalu'])
  periode?: 'hari-ini' | '7-hari' | 'bulan-ini' | 'bulan-lalu';
}
