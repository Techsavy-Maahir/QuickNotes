import React, { useEffect } from 'react';
import { getFileIcon, formatBytes } from './AttachmentManager';

function AttachmentPreviewModal({
  attachment,
  previewUrl,
  downloadUrl,
  onClose,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!attachment) return null;

  const ext = (attachment.originalName || '')
    .slice(attachment.originalName.lastIndexOf('.'))
    .toLowerCase();

  const isImage =
    ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ||
    attachment.mimeType?.startsWith('image/');
  const isPdf = ext === '.pdf' || attachment.mimeType?.includes('pdf');
  const isTextOrCsv =
    ['.txt', '.csv'].includes(ext) || attachment.mimeType?.includes('text');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/80">
          <div className="flex items-center space-x-2.5 min-w-0 mr-4">
            <span className="text-2xl flex-shrink-0">
              {getFileIcon(attachment.originalName, attachment.mimeType)}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {attachment.originalName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatBytes(attachment.size)} · Uploaded{' '}
                {new Date(attachment.uploadedAt || Date.now()).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={attachment.originalName}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>⬇️</span> Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold leading-none rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close preview"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900/60 min-h-[300px]">
          {isImage ? (
            <img
              src={previewUrl}
              alt={attachment.originalName}
              className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-md"
            />
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              title={attachment.originalName}
              className="w-full h-[70vh] border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white"
            />
          ) : isTextOrCsv ? (
            <iframe
              src={previewUrl}
              title={attachment.originalName}
              className="w-full h-[60vh] border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white font-mono p-2 text-xs"
            />
          ) : (
            /* Document / Spreadsheet fallback */
            <div className="text-center p-8 max-w-md bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-5xl mb-3">
                {getFileIcon(attachment.originalName, attachment.mimeType)}
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                Preview Not Supported
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                In-browser preview is only available for Images, PDFs, and Plain Text files.
                You can download the original file to view it with your office application.
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={attachment.originalName}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  <span>⬇️</span> Download {attachment.originalName}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttachmentPreviewModal;
