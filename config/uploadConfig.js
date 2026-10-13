const path = require('path');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit per file
const MAX_ATTACHMENTS_PER_NOTE = 10;
const MAX_FILES_PER_UPLOAD = 5;

// Whitelist of allowed extensions and their corresponding MIME types
const ALLOWED_EXTENSIONS_MAP = {
  // PDF
  '.pdf': ['application/pdf'],
  // Images
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  // Documents
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  '.txt': ['text/plain'],
  // Spreadsheets
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  '.csv': ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
};

/**
 * Validates file buffer magic bytes where applicable.
 */
function validateMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;

  const hexPrefix = buffer.subarray(0, 8).toString('hex').toLowerCase();

  switch (ext) {
    case '.pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case '.png':
      return hexPrefix.startsWith('89504e470d0a1a0a');
    case '.jpg':
    case '.jpeg':
      return hexPrefix.startsWith('ffd8ff');
    case '.webp':
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.length >= 12 &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case '.docx':
    case '.xlsx':
      return hexPrefix.startsWith('504b0304');
    case '.doc':
    case '.xls':
      return (
        hexPrefix.startsWith('d0cf11e0') ||
        hexPrefix.startsWith('504b0304')
      );
    case '.txt':
    case '.csv': {
      const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

function validateUploadedFile(file) {
  if (!file || !file.originalname) {
    return { valid: false, message: 'No file provided' };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ALLOWED_EXTENSIONS_MAP[ext];

  if (!allowedMimes) {
    return {
      valid: false,
      message: `Unsupported file extension (${ext}). Allowed formats: PDF, PNG, JPG, JPEG, WEBP, DOC, DOCX, TXT, XLS, XLSX, CSV.`,
    };
  }

  const clientMime = (file.mimetype || '').toLowerCase();
  const mimeMatched =
    allowedMimes.includes(clientMime) ||
    clientMime === 'application/octet-stream';

  if (!mimeMatched) {
    return {
      valid: false,
      message: `Invalid MIME type (${file.mimetype}) for extension ${ext}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: `File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
    };
  }

  if (file.buffer) {
    const magicValid = validateMagicBytes(file.buffer, ext);
    if (!magicValid) {
      return {
        valid: false,
        message: `File content does not match expected format for ${ext}`,
      };
    }
  }

  return { valid: true, ext, mimeType: allowedMimes[0] };
}

module.exports = {
  MAX_FILE_SIZE,
  MAX_ATTACHMENTS_PER_NOTE,
  MAX_FILES_PER_UPLOAD,
  ALLOWED_EXTENSIONS_MAP,
  validateUploadedFile,
  validateMagicBytes,
};
