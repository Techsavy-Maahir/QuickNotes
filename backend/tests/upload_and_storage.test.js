const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  validateUploadedFile,
  validateMagicBytes,
  MAX_FILE_SIZE,
} = require('../config/uploadConfig');
const storageService = require('../services/storageService');
const {
  isNoteOwner,
  canViewNote,
  canEditNote,
  getUserPermission,
} = require('../utils/permissions');

test('File Upload Config & Validation', async (t) => {
  await t.test('accepts valid PDF with proper header', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 sample content');
    const res = validateUploadedFile({
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      buffer: pdfBuffer,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.ext, '.pdf');
  });

  await t.test('accepts valid PNG image', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const res = validateUploadedFile({
      originalname: 'image.png',
      mimetype: 'image/png',
      size: pngBuffer.length,
      buffer: pngBuffer,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.ext, '.png');
  });

  await t.test('accepts valid JPEG image', () => {
    const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = validateUploadedFile({
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: jpgBuffer.length,
      buffer: jpgBuffer,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.ext, '.jpg');
  });

  await t.test('accepts valid WEBP image', () => {
    const webpBuffer = Buffer.from('RIFF....WEBPVP8 ');
    const res = validateUploadedFile({
      originalname: 'graphic.webp',
      mimetype: 'image/webp',
      size: webpBuffer.length,
      buffer: webpBuffer,
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.ext, '.webp');
  });

  await t.test('accepts valid DOCX and XLSX documents', () => {
    const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const docxRes = validateUploadedFile({
      originalname: 'report.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: zipBuffer.length,
      buffer: zipBuffer,
    });
    assert.strictEqual(docxRes.valid, true);

    const xlsxRes = validateUploadedFile({
      originalname: 'budget.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: zipBuffer.length,
      buffer: zipBuffer,
    });
    assert.strictEqual(xlsxRes.valid, true);
  });

  await t.test('accepts valid plain text and CSV files', () => {
    const txtBuffer = Buffer.from('Hello world, this is a plain text file.');
    const res = validateUploadedFile({
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: txtBuffer.length,
      buffer: txtBuffer,
    });
    assert.strictEqual(res.valid, true);

    const csvBuffer = Buffer.from('id,name,amount\n1,alpha,200\n2,beta,500');
    const csvRes = validateUploadedFile({
      originalname: 'data.csv',
      mimetype: 'text/csv',
      size: csvBuffer.length,
      buffer: csvBuffer,
    });
    assert.strictEqual(csvRes.valid, true);
  });

  await t.test('rejects unsupported file formats (.exe, .sh, .py, .html)', () => {
    const exeRes = validateUploadedFile({
      originalname: 'virus.exe',
      mimetype: 'application/x-msdownload',
      size: 100,
    });
    assert.strictEqual(exeRes.valid, false);
    assert.match(exeRes.message, /Unsupported file extension/);

    const shRes = validateUploadedFile({
      originalname: 'script.sh',
      mimetype: 'application/x-sh',
      size: 50,
    });
    assert.strictEqual(shRes.valid, false);
  });

  await t.test('rejects oversized files exceeding 10MB limit', () => {
    const res = validateUploadedFile({
      originalname: 'huge.pdf',
      mimetype: 'application/pdf',
      size: 11 * 1024 * 1024,
    });
    assert.strictEqual(res.valid, false);
    assert.match(res.message, /exceeds 10MB limit/);
  });

  await t.test('rejects files with spoofed extension and invalid magic bytes', () => {
    // Malicious file disguised as PDF containing plain text or random binary
    const badBuffer = Buffer.from('NOT_A_REAL_PDF_HEADER');
    const res = validateUploadedFile({
      originalname: 'fake.pdf',
      mimetype: 'application/pdf',
      size: badBuffer.length,
      buffer: badBuffer,
    });
    assert.strictEqual(res.valid, false);
    assert.match(res.message, /File content does not match expected format/);
  });
});

test('Storage Service Operations', async (t) => {
  const testBuffer = Buffer.from('%PDF-1.4 QuickNotes Test File Content');
  let savedKey = null;

  await t.test('uploads file and generates safe storage key', async () => {
    const uploadRes = await storageService.uploadFile({
      buffer: testBuffer,
      originalName: 'test-doc.pdf',
      mimeType: 'application/pdf',
    });

    assert.ok(uploadRes.storageKey);
    assert.ok(uploadRes.storageKey.endsWith('.pdf'));
    // Ensure filename does not contain user input path
    assert.ok(!uploadRes.storageKey.includes('test-doc'));
    savedKey = uploadRes.storageKey;
  });

  await t.test('retrieves stored file stream and verifies contents', async () => {
    assert.ok(savedKey);
    const fileData = await storageService.getFileStream(savedKey);
    assert.ok(fileData.stream);

    // Collect stream
    const chunks = [];
    for await (const chunk of fileData.stream) {
      chunks.push(chunk);
    }
    const retrieved = Buffer.concat(chunks);
    assert.deepStrictEqual(retrieved, testBuffer);
  });

  await t.test('deletes stored file cleanly', async () => {
    assert.ok(savedKey);
    const deleted = await storageService.deleteFile(savedKey);
    assert.strictEqual(deleted, true);

    // Attempting to retrieve should fail
    await assert.rejects(async () => {
      await storageService.getFileStream(savedKey);
    });
  });
});

test('Permissions and Authorization Logic', async (t) => {
  const ownerId = '60d0fe4f5311236168a109ca';
  const editorId = '60d0fe4f5311236168a109cb';
  const viewerId = '60d0fe4f5311236168a109cc';
  const strangerId = '60d0fe4f5311236168a109cd';

  const note = {
    userId: ownerId,
    title: 'Architecture Review',
    collaborators: [
      { userId: editorId, email: 'editor@example.com', permission: 'edit' },
      { userId: viewerId, email: 'viewer@example.com', permission: 'view' },
    ],
  };

  await t.test('Owner has full view and edit permissions', () => {
    assert.strictEqual(isNoteOwner(note, ownerId), true);
    assert.strictEqual(canViewNote(note, ownerId), true);
    assert.strictEqual(canEditNote(note, ownerId), true);
    assert.strictEqual(getUserPermission(note, ownerId), 'owner');
  });

  await t.test('Editor collaborator can view and edit, but is not owner', () => {
    assert.strictEqual(isNoteOwner(note, editorId), false);
    assert.strictEqual(canViewNote(note, editorId), true);
    assert.strictEqual(canEditNote(note, editorId), true);
    assert.strictEqual(getUserPermission(note, editorId), 'edit');
  });

  await t.test('Viewer collaborator can view, but cannot edit or own', () => {
    assert.strictEqual(isNoteOwner(note, viewerId), false);
    assert.strictEqual(canViewNote(note, viewerId), true);
    assert.strictEqual(canEditNote(note, viewerId), false);
    assert.strictEqual(getUserPermission(note, viewerId), 'view');
  });

  await t.test('Stranger without access cannot view, edit, or own', () => {
    assert.strictEqual(isNoteOwner(note, strangerId), false);
    assert.strictEqual(canViewNote(note, strangerId), false);
    assert.strictEqual(canEditNote(note, strangerId), false);
    assert.strictEqual(getUserPermission(note, strangerId), null);
  });
});
