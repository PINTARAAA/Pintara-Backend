import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { env } from '../../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../../common/errors';

export interface UploadedFileResponse {
  id: string;
  name: string;
  size: number;
  url: string;
  mimeType: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (env.storageDriver === 's3') {
      this.s3 = new S3Client({
        region: env.s3.region,
        endpoint: env.s3.endpoint,
        forcePathStyle: env.s3.forcePathStyle,
        credentials:
          env.s3.accessKeyId && env.s3.secretAccessKey
            ? {
                accessKeyId: env.s3.accessKeyId,
                secretAccessKey: env.s3.secretAccessKey,
              }
            : undefined,
      });
    }
  }

  async save(
    file: Express.Multer.File | undefined,
    uploadedById?: string,
  ): Promise<UploadedFileResponse> {
    if (!file) throw ApiException.badRequest('File wajib diunggah');
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      throw ApiException.unprocessable(
        'Format tidak didukung. Gunakan JPG, PNG, atau PDF maks. 5 MB.',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw ApiException.unprocessable(
        'Format tidak didukung. Gunakan JPG, PNG, atau PDF maks. 5 MB.',
      );
    }

    const ext = extname(file.originalname) || mimeExt(file.mimetype);
    const key = `${randomUUID()}${ext}`;
    let url: string;

    if (env.storageDriver === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      url = env.s3.publicBaseUrl
        ? `${env.s3.publicBaseUrl.replace(/\/$/, '')}/${key}`
        : `${env.s3.endpoint ?? ''}/${env.s3.bucket}/${key}`;
    } else {
      const dir = join(process.cwd(), env.storageLocalDir);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, key), file.buffer);
      url = `/uploads/${key}`;
    }

    const saved = await this.prisma.file.create({
      data: {
        filename: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        driver: env.storageDriver,
        key,
        url,
        uploadedById: uploadedById ?? null,
      },
    });

    return {
      id: saved.id,
      name: saved.originalName,
      size: saved.size,
      url: saved.url,
      mimeType: saved.mimeType,
    };
  }

  async removeByKey(key: string) {
    try {
      if (env.storageDriver === 's3' && this.s3) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }),
        );
      } else {
        await unlink(join(process.cwd(), env.storageLocalDir, key));
      }
    } catch (error) {
      this.logger.warn(`Gagal menghapus file ${key}: ${(error as Error).message}`);
    }
  }
}

function mimeExt(mime: string) {
  if (mime === 'image/png') return '.png';
  if (mime === 'application/pdf') return '.pdf';
  return '.jpg';
}
