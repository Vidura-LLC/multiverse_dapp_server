import multer from 'multer';
import { S3_CONFIG } from '../config/s3';

// Configure multer for memory storage (since we're uploading to S3)
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Check file type
  if (S3_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${S3_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: S3_CONFIG.MAX_FILE_SIZE, // 5MB
    files: 1, // Only one file at a time
  },
});

// Middleware for handling multer errors
export const handleMulterError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: `File size too large. Maximum allowed size is ${S3_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB` 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Only one file allowed.' });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({ message: error.message });
  }
  
  next(error);
};