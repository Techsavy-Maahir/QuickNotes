const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

// Persistent local upload directory fallback
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

// Initialize local directory if not using S3 or as fallback
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const isS3Configured = Boolean(
  (process.env.STORAGE_PROVIDER === 's3' || process.env.S3_BUCKET) &&
    process.env.S3_BUCKET &&
    (process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID)
);

let s3Client = null;
if (isS3Configured) {
  const s3Config = {
    region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId:
        process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
    },
  };

  // Support custom endpoint (Cloudflare R2, MinIO, Supabase, Backblaze B2)
  if (process.env.S3_ENDPOINT) {
    s3Config.endpoint = process.env.S3_ENDPOINT;
  }
  if (process.env.S3_FORCE_PATH_STYLE === 'true') {
    s3Config.forcePathStyle = true;
  }

  s3Client = new S3Client(s3Config);
}

/**
 * Generate cryptographically secure and unguessable storage key
 */
function generateStorageKey(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const safeRandomId = crypto.randomUUID();
  return `${Date.now()}-${safeRandomId}${ext}`;
}

/**
 * Validates storage key to prevent directory traversal
 */
function sanitizeKey(storageKey) {
  const baseName = path.basename(storageKey);
  if (baseName !== storageKey || storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
    throw new Error('Invalid storage key format');
  }
  return baseName;
}

/**
 * Upload a file to storage (S3 or persistent local storage)
 */
async function uploadFile({ buffer, originalName, mimeType }) {
  const storageKey = generateStorageKey(originalName);

  if (s3Client && process.env.S3_BUCKET) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    });
    await s3Client.send(command);
    return {
      storageKey,
      provider: 's3',
      size: buffer.length,
    };
  }

  // Persistent local disk storage fallback
  const safeKey = sanitizeKey(storageKey);
  const targetPath = path.join(UPLOAD_DIR, safeKey);
  await fs.promises.writeFile(targetPath, buffer);

  return {
    storageKey: safeKey,
    provider: 'local',
    size: buffer.length,
  };
}

/**
 * Retrieve a file stream and metadata from storage
 */
async function getFileStream(storageKey) {
  const safeKey = sanitizeKey(storageKey);

  if (s3Client && process.env.S3_BUCKET) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: safeKey,
    });
    const response = await s3Client.send(command);
    return {
      stream: response.Body,
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  // Persistent local storage
  const filePath = path.join(UPLOAD_DIR, safeKey);
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found in storage');
  }

  const stat = await fs.promises.stat(filePath);
  const stream = fs.createReadStream(filePath);

  return {
    stream,
    contentLength: stat.size,
  };
}

/**
 * Delete a file from storage
 */
async function deleteFile(storageKey) {
  try {
    const safeKey = sanitizeKey(storageKey);

    if (s3Client && process.env.S3_BUCKET) {
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: safeKey,
      });
      await s3Client.send(command);
      return true;
    }

    const filePath = path.join(UPLOAD_DIR, safeKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return true;
  } catch (err) {
    console.error(`Failed to delete storage file (${storageKey}):`, err.message);
    return false;
  }
}

/**
 * Delete multiple files from storage
 */
async function deleteMultipleFiles(storageKeys) {
  if (!Array.isArray(storageKeys) || storageKeys.length === 0) return;
  await Promise.allSettled(storageKeys.map((key) => deleteFile(key)));
}

module.exports = {
  uploadFile,
  getFileStream,
  deleteFile,
  deleteMultipleFiles,
  generateStorageKey,
  isS3Configured: () => Boolean(s3Client),
};
