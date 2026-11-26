export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://pintara:pintara@localhost:5432/pintara?schema=public',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret:
    process.env.JWT_SECRET ?? 'pintara-development-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  throttleTtlMs: Number(process.env.THROTTLE_TTL ?? 900) * 1000,
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 300),
  authThrottleLimit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 20),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60),
  storageDriver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? 'uploads',
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'pintara',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  },
  isProduction: process.env.NODE_ENV === 'production',
};
