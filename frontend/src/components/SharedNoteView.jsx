import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getFileIcon, formatBytes } from './AttachmentManager';
import AttachmentPreviewModal from './AttachmentPreviewModal';

function SharedNoteView({ token, onBackToApp, darkMode, toggleDarkMode }) {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null); // null | 404 | 410 | 500
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preview State
  const [previewAttachment, setPreviewAttachment] = useState(null);

  useEffect(() => {
    const fetchSharedNote = async () => {
      try {
        setLoading(true);
        setErrorStatus(null);
        const response = await axios.get(
          `http://localhost:5000/api/shared/notes/${token}`
        );
        setNote(response.data);
        setTitle(response.data.title);
        setContent(response.data.content);
      } catch (err) {
        if (err.response?.status === 410) {
          setErrorStatus(410);
        } else if (err.response?.status === 404) {
          setErrorStatus(404);
        } else {
          setErrorStatus(500);
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSharedNote();
    }
  }, [token]);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      await axios.put(`http://localhost:5000/api/shared/notes/${token}`, {
        title,
        content,
      });
      setNote((prev) => ({
        ...prev,
        title,
        content,
        updatedAt: new Date().toISOString(),
      }));
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save changes to shared note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-slate-900 dark:text-gray-100 transition-colors duration-300 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span>🔒</span> QuickNotes
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium ml-2">
              Shared Note
            </span>
          </div>

          <div className="flex items-center gap-3">
            {toggleDarkMode && (
              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-base"
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            )}
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1">
        {loading ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <div className="text-3xl mb-3 animate-spin">⏳</div>
            <p className="text-sm">Loading shared note...</p>
          </div>
        ) : errorStatus === 410 ? (
          <div className="text-center py-20 max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-5xl mb-4">⌛</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              This share link has expired
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              The owner configured this link with an expiration date that has passed.
              Please contact the note owner to request a new link.
            </p>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow transition-colors"
              >
                Return to QuickNotes
              </button>
            )}
          </div>
        ) : errorStatus === 404 ? (
          <div className="text-center py-20 max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Note not found or link revoked
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              This note may have been deleted, unshared, or the link may have been revoked by the owner.
            </p>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow transition-colors"
              >
                Return to QuickNotes
              </button>
            )}
          </div>
        ) : errorStatus ? (
          <div className="text-center py-20 max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Unable to load note
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              A connection error occurred while loading this note. Please try again later.
            </p>
          </div>
        ) : note ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-6 sm:p-8 space-y-6">
            {saveSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300 rounded-lg">
                ✓ Changes saved successfully!
              </div>
            )}

            {/* Note Meta Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                  {note.category || 'General'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Shared by <span className="font-medium text-gray-700 dark:text-gray-300">{note.ownerEmail}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                  {note.permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only'}
                </span>

                {note.permission === 'edit' && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded shadow transition-colors"
                  >
                    Edit Note
                  </button>
                )}
              </div>
            </div>

            {/* Editing Form vs Display */}
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Content
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    required
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(note.title);
                      setContent(note.content);
                      setIsEditing(false);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg shadow disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {note.title}
                </h1>
                <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                  {note.content}
                </div>
              </div>
            )}

            {/* Attachments Section */}
            {note.attachments && note.attachments.length > 0 && (
              <div className="pt-6 border-t border-gray-100 dark:border-gray-700 space-y-3">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Attachments ({note.attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {note.attachments.map((att) => (
                    <div
                      key={att._id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/40 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 mr-2">
                        <span className="text-2xl flex-shrink-0">
                          {getFileIcon(att.originalName, att.mimeType)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {att.originalName}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatBytes(att.size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                        >
                          Preview
                        </button>
                        <a
                          href={`http://localhost:5000/api/shared/notes/${token}/attachments/${att._id}/download`}
                          download={att.originalName}
                          className="px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          previewUrl={`http://localhost:5000/api/shared/notes/${token}/attachments/${previewAttachment._id}/preview`}
          downloadUrl={`http://localhost:5000/api/shared/notes/${token}/attachments/${previewAttachment._id}/download`}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}

export default SharedNoteView;
