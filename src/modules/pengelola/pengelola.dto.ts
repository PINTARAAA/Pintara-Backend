import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
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
