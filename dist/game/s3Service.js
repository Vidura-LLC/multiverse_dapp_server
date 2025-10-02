"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Service = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3_1 = require("../config/s3");
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
class S3Service {
    /**
     * Upload a file to S3
     */
    static uploadFile(file_1) {
        return __awaiter(this, arguments, void 0, function* (file, folder = s3_1.S3_CONFIG.GAMES_FOLDER) {
            try {
                // Validate file
                this.validateFile(file);
                // Generate unique filename
                const fileExtension = path_1.default.extname(file.originalname);
                const fileName = `${(0, uuid_1.v4)()}${fileExtension}`;
                const key = `${folder}/${fileName}`;
                // Upload command
                const command = new client_s3_1.PutObjectCommand({
                    Bucket: s3_1.S3_CONFIG.BUCKET_NAME,
                    Key: key,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    ContentDisposition: 'inline',
                    CacheControl: 'max-age=31536000', // 1 year cache
                    Metadata: {
                        originalName: file.originalname,
                        uploadedAt: new Date().toISOString(),
                    },
                });
                yield s3_1.s3Client.send(command);
                // Construct the public URL
                const url = `https://${s3_1.S3_CONFIG.BUCKET_NAME}.s3.${s3_1.S3_CONFIG.REGION}.amazonaws.com/${key}`;
                return {
                    url,
                    key,
                    bucket: s3_1.S3_CONFIG.BUCKET_NAME,
                };
            }
            catch (error) {
                console.error('Error uploading file to S3:', error);
                throw new Error('Failed to upload file to S3');
            }
        });
    }
    /**
     * Delete a file from S3
     */
    static deleteFile(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const command = new client_s3_1.DeleteObjectCommand({
                    Bucket: s3_1.S3_CONFIG.BUCKET_NAME,
                    Key: key,
                });
                yield s3_1.s3Client.send(command);
            }
            catch (error) {
                console.error('Error deleting file from S3:', error);
                throw new Error('Failed to delete file from S3');
            }
        });
    }
    /**
     * Generate a presigned URL for private access (if needed)
     */
    static getPresignedUrl(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, expiresIn = 3600) {
            try {
                const command = new client_s3_1.GetObjectCommand({
                    Bucket: s3_1.S3_CONFIG.BUCKET_NAME,
                    Key: key,
                });
                return yield (0, s3_request_presigner_1.getSignedUrl)(s3_1.s3Client, command, { expiresIn });
            }
            catch (error) {
                console.error('Error generating presigned URL:', error);
                throw new Error('Failed to generate presigned URL');
            }
        });
    }
    /**
     * Extract S3 key from URL
     */
    static extractKeyFromUrl(url) {
        try {
            const urlPattern = new RegExp(`https://${s3_1.S3_CONFIG.BUCKET_NAME}\\.s3\\.${s3_1.S3_CONFIG.REGION}\\.amazonaws\\.com/(.+)`);
            const match = url.match(urlPattern);
            return match ? match[1] : null;
        }
        catch (error) {
            console.error('Error extracting key from URL:', error);
            return null;
        }
    }
    /**
     * Validate uploaded file
     */
    static validateFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }
        if (file.size > s3_1.S3_CONFIG.MAX_FILE_SIZE) {
            throw new Error(`File size exceeds maximum allowed size of ${s3_1.S3_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
        }
        if (!s3_1.S3_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            throw new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${s3_1.S3_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`);
        }
    }
}
exports.S3Service = S3Service;
//# sourceMappingURL=s3Service.js.map