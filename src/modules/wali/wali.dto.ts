import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class PendaftaranDto {
  @IsString() @MinLength(1) parentName!: string;
  @IsString() @MinLength(1) parentPhone!: string;
  @IsString() @MinLength(1) studentName!: string;
  @IsString() @MinLength(1) grade!: string;
  @IsString() @MinLength(1) school!: string;
  @IsString() @MinLength(1) address!: string;
  @IsArray() @IsString({ each: true }) subjects!: string[];
  @IsString() @MinLength(1) frequency!: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray() @IsString({ each: true }) days!: string[];
  @IsString() @MinLength(1) startTime!: string;
}

export class SubmitChangeDto {
  @IsString() @MinLength(1) routineId!: string;
  @IsString() @MinLength(1) scope!: string;
  @IsString() @MinLength(1) day!: string;
  @IsString() @MinLength(1) startTime!: string;
  @IsString() @MinLength(1) reason!: string;
}

export class ObjectionDto {
  @IsString() @MinLength(1) reason!: string;
}

export class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @IsOptional() comment?: string;
}

export class PayBillDto {
  @IsNumber() @Min(1) nominal!: number;
  @IsBoolean() @IsOptional() simulateFailure?: boolean;
}

export class BelumDigunakanDto {
  @IsOptional() _?: string;
}
