import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class AttachmentDto {
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(1) size!: number;
}

export class AttendanceDto {
  @IsBoolean() held!: boolean;
  @IsString() @IsOptional() actualStart?: string;
  @IsString() @IsOptional() actualEnd?: string;
  @IsBoolean() @IsOptional() studentPresent?: boolean;
  @IsString() @IsOptional() topic?: string;
  @IsString() @IsOptional() notes?: string;
  @IsOptional() @ValidateNested() @Type(() => AttachmentDto)
  attachment?: AttachmentDto;
  @IsString() @IsOptional() cancelReason?: string;
}

export class TutorChangeDto {
  @IsString() @MinLength(1) routineId!: string;
  @IsString() @MinLength(1) scope!: string;
  @IsString() @MinLength(1) day!: string;
  @IsString() @MinLength(1) startTime!: string;
  @IsString() @MinLength(1) reason!: string;
}

export class TutorReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @IsOptional() comment?: string;
}
