import React, { useState, useRef } from 'react';

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.doc',
  '.docx',
  '.txt',
  '.xls',
  '.xlsx',
  '.csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileIcon(filename = '', mimeType = '') {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) || mimeType.startsWith('image/')) {
    return '🖼️';
  }
  if (ext === '.pdf' || mimeType.includes('pdf')) {
    return '📕';
  }
  if (['.xls', '.xlsx', '.csv'].includes(ext) || mimeType.includes('sheet') || mimeType.includes('csv')) {
    return '📊';
  }
  if (['.doc', '.docx', '.txt'].includes(ext) || mimeType.includes('word') || mimeType.includes('text')) {
    return '📝';
  }
  return '📎';
}

function AttachmentManager({
  existingAttachments = [],
  pendingFiles = [],
  onPendingFilesChange,
  onDeleteExisting,
  onPreview,
  onDownload,
  canEdit = true,
  isUploading = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef(null);

  const validateAndAddFiles = (incomingFiles) => {
    setValidationError('');
    const newFiles = [];
    const existingCount = (existingAttachments?.length || 0) + pendingFiles.length;

    if (existingCount + incomingFiles.length > 10) {
      setValidationError('A note can have a maximum of 10 attachments.');
      return;
    }

    for (const file of incomingFiles) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setValidationError(
          `Unsupported file "${file.name}". Supported: PDF, Images (PNG, JPG, WEBP), Documents (DOC, DOCX, TXT), Spreadsheets (XLS, XLSX, CSV).`
        );
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(
          `File "${file.name}" exceeds the 10MB size limit (${formatBytes(file.size)}).`
        );
        return;
      }
      // Check duplicate in pending
      const isDuplicate = pendingFiles.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (!isDuplicate) {
        newFiles.push(file);
      }
    }

    if (newFiles.length > 0 && onPendingFilesChange) {
      onPendingFilesChange([...pendingFiles, ...newFiles]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (canEdit && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canEdit || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input to allow re-uploading same file
    }
  };

  const handleRemovePending = (index) => {
    if (onPendingFilesChange) {
      const updated = pendingFiles.filter((_, i) => i !== index);
      onPendingFilesChange(updated);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Attachments{' '}
          <span className="text-xs text-gray-500 font-normal">
            (Max 10 files · Up to 10MB each)
          </span>
        </label>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="p-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 rounded-lg flex items-center justify-between">
          <span>⚠️ {validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError('')}
            className="text-red-500 hover:text-red-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Drop Zone for Adding Files */}
      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50/50 dark:bg-gray-800/40'
          } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,.xls,.xlsx,.csv"
            className="hidden"
            disabled={isUploading}
          />
          <div className="flex flex-col items-center justify-center space-y-1">
            <span className="text-2xl">📎</span>
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
              {isUploading
                ? 'Uploading attachments...'
                : 'Click to upload or drag and drop files here'}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              PDF, PNG, JPG, WEBP, DOC, DOCX, TXT, XLS, XLSX, CSV
            </p>
          </div>
        </div>
      )}

      {/* Pending Files (Selected before save/upload) */}
      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Ready to attach ({pendingFiles.length})
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            {pendingFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                  <span className="text-lg flex-shrink-0">
                    {getFileIcon(file.name, file.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>
                {canEdit && !isUploading && (
                  <button
                    type="button"
                    onClick={() => handleRemovePending(idx)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                    title="Remove from upload"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Attachments on Note */}
      {existingAttachments && existingAttachments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Current Attachments ({existingAttachments.length})
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            {existingAttachments.map((attachment) => (
              <div
                key={attachment._id}
                className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                  <span className="text-lg flex-shrink-0">
                    {getFileIcon(attachment.originalName, attachment.mimeType)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {attachment.originalName}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {formatBytes(attachment.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  {onPreview && (
                    <button
                      type="button"
                      onClick={() => onPreview(attachment)}
                      className="px-2 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="Preview attachment"
                    >
                      Preview
                    </button>
                  )}
                  {onDownload && (
                    <button
                      type="button"
                      onClick={() => onDownload(attachment)}
                      className="px-2 py-1 text-[11px] font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Download file"
                    >
                      Download
                    </button>
                  )}
                  {canEdit && onDeleteExisting && (
                    <button
                      type="button"
                      onClick={() => onDeleteExisting(attachment._id)}
                      className="px-2 py-1 text-[11px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete attachment"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AttachmentManager;
