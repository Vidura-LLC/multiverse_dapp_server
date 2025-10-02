"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3_CONFIG = exports.s3Client = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
// AWS S3 Configuration
exports.s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
exports.S3_CONFIG = {
    BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    REGION: process.env.AWS_REGION || 'us-east-1',
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    GAMES_FOLDER: 'games', // S3 folder for game images
};
//# sourceMappingURL=s3.js.map