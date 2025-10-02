"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMulterError = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const s3_1 = require("../config/s3");
// Configure multer for memory storage (since we're uploading to S3)
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    // Check file type
    if (s3_1.S3_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Invalid file type. Allowed types: ${s3_1.S3_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`), false);
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: s3_1.S3_CONFIG.MAX_FILE_SIZE, // 5MB
        files: 1, // Only one file at a time
    },
});
// Middleware for handling multer errors
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: `File size too large. Maximum allowed size is ${s3_1.S3_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
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
exports.handleMulterError = handleMulterError;
//# sourceMappingURL=mutler.js.map