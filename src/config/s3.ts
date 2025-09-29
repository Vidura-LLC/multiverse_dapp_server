
import { S3Client } from '@aws-sdk/client-s3';

// AWS S3 Configuration
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const S3_CONFIG = {
  BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME!,
  REGION: process.env.AWS_REGION || 'us-east-1',
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  GAMES_FOLDER: 'games', // S3 folder for game images
};