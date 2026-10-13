import { useState, useEffect } from 'react';
import axios from 'axios';
import AttachmentManager, {
  getFileIcon,
  formatBytes,
} from '../components/AttachmentManager';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import ShareModal from '../components/ShareModal';

function NotesPage({ token, onLogout, darkMode, toggleDarkMode }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [creatingNote, setCreatingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Attachment & Sharing States
  const [pendingFiles, setPendingFiles] = useState([]);
  const [activeNoteAttachments, setActiveNoteAttachments] = useState([]);
  const [sharingNote, setSharingNote] = useState(null);
  const [previewData, setPreviewData] = useState(null); // { noteId, attachment }

  const categories = ['General', 'Science', 'Math', 'Work', 'Personal'];

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const getTimeAgo = (date) => {
    if (!date) return 'Unknown';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const params =
        selectedCategory &&
        selectedCategory !== '__pinned__' &&
        selectedCategory !== '__shared__'
          ? { category: selectedCategory }
          : {};

      // Fetch user's own notes and shared notes concurrently
      const [ownResponse, sharedResponse] = await Promise.all([
        axios.get('http://localhost:5000/api/notes', { headers, params }),
        axios
          .get('http://localhost:5000/api/notes/shared-with-me', { headers })
          .catch(() => ({ data: [] })),
      ]);

      const ownNotes = (ownResponse.data || []).map((note) => ({
        ...note,
        pinned: Boolean(note.pinned),
        isOwner: true,
        userPermission: 'owner',
      }));

      const sharedNotes = (sharedResponse.data || []).map((note) => ({
        ...note,
        pinned: false,
        isOwner: false,
      }));

      // Combine notes
      setNotes([...ownNotes, ...sharedNotes]);
      setError('');
    } catch (err) {
      setError('Failed to fetch notes');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const filteredNotes = notes
    .filter((note) => {
      if (selectedCategory === '__pinned__' && !note.pinned) {
        return false;
      }
      if (selectedCategory === '__shared__' && note.isOwner) {
        return false;
      }
      const searchLower = searchTerm.toLowerCase();
      const noteTitle = (note.title || '').toLowerCase();
      const noteContent = (note.content || '').toLowerCase();
      return (
        noteTitle.includes(searchLower) || noteContent.includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Pinned notes first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt)
      );
    });

  const handleTogglePin = async (noteId) => {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/notes/${noteId}/pin`,
        {},
        { headers }
      );
      const updatedNote = response.data;
      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note._id === noteId ? { ...note, pinned: updatedNote.pinned } : note
        )
      );
    } catch (err) {
      setError('Failed to toggle pin');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSubmitNote = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setCreatingNote(true);
      let targetNoteId = editingNoteId;

      if (editingNoteId) {
        // Update existing note
        const res = await axios.put(
          `http://localhost:5000/api/notes/${editingNoteId}`,
          { title, content, category },
          { headers }
        );
        targetNoteId = res.data._id;
      } else {
        // Create note
        const res = await axios.post(
          'http://localhost:5000/api/notes',
          { title, content, category },
          { headers }
        );
        targetNoteId = res.data._id;
      }

      // If pending files are selected, upload them now
      if (pendingFiles.length > 0 && targetNoteId) {
        const formData = new FormData();
        pendingFiles.forEach((file) => {
          formData.append('files', file);
        });

        await axios.post(
          `http://localhost:5000/api/notes/${targetNoteId}/attachments`,
          formData,
          {
            headers: {
              ...headers,
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      }

      setTitle('');
      setContent('');
      setCategory('General');
      setPendingFiles([]);
      setActiveNoteAttachments([]);
      setEditingNoteId(null);
      setShowCreateForm(false);
      setError('');
      fetchNotes();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (editingNoteId ? 'Failed to update note' : 'Failed to create note');
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } finally {
      setCreatingNote(false);
    }
  };

  const handleStartEdit = (note) => {
    setEditingNoteId(note._id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category || 'General');
    setActiveNoteAttachments(note.attachments || []);
    setPendingFiles([]);
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setCategory('General');
    setPendingFiles([]);
    setActiveNoteAttachments([]);
    setShowCreateForm(false);
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note? All attached files will also be permanently removed.')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/api/notes/${noteId}`, {
        headers,
      });
      if (editingNoteId === noteId) {
        handleCancelEdit();
      }
      fetchNotes();
    } catch (err) {
      setError('Failed to delete note');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Delete attachment from existing note
  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    try {
      const res = await axios.delete(
        `http://localhost:5000/api/notes/${editingNoteId}/attachments/${attachmentId}`,
        { headers }
      );
      setActiveNoteAttachments(res.data.attachments || []);
      // Update local state
      setNotes((prev) =>
        prev.map((n) =>
          n._id === editingNoteId
            ? { ...n, attachments: res.data.attachments }
            : n
        )
      );
    } catch (err) {
      setError('Failed to delete attachment');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Preview helper
  const handleOpenPreview = (noteId, attachment) => {
    setPreviewData({ noteId, attachment });
  };

  const handleDownloadAttachment = (noteId, attachment) => {
    const url = `http://localhost:5000/api/notes/${noteId}/attachments/${attachment._id}/download`;
    const link = document.createElement('a');
    link.href = url;
    // Set authorization header via fetch download or direct url if token
    // Using fetch with bearer token to create blob download
    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = attachment.originalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        setError('Failed to download attachment');
        setTimeout(() => setError(''), 3000);
      });
  };

  const existingCategories = Array.from(
    new Set([...categories, ...notes.map((n) => n.category).filter(Boolean)])
  );

  const sharedNotesCount = notes.filter((n) => !n.isOwner).length;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 transition-colors duration-300">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span>🔒</span> QuickNotes
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg"
              title={darkMode ? 'Light mode' : 'Dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button
              onClick={onLogout}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {/* Greeting Section */}
        <div className="py-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            {getGreeting()} 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg mt-1">
            Your thoughts and shared files, secure and organized.
          </p>
        </div>

        {/* Search Bar UI */}
        <div>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search your notes by title or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchTerm('');
              }}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors duration-200"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm p-0.5 rounded-full"
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills (Categories + Pinned + Shared) */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === ''
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All Notes
          </button>
          <button
            type="button"
            onClick={() =>
              setSelectedCategory((prev) =>
                prev === '__pinned__' ? '' : '__pinned__'
              )
            }
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === '__pinned__'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <span>📌</span>
            <span>Pinned</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setSelectedCategory((prev) =>
                prev === '__shared__' ? '' : '__shared__'
              )
            }
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === '__shared__'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <span>👥</span>
            <span>Shared with me</span>
            {sharedNotesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-[11px] font-bold">
                {sharedNotesCount}
              </span>
            )}
          </button>
          {existingCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* "+ New Note" Button */}
        <div className="text-center py-2">
          <button
            onClick={() => {
              handleCancelEdit();
              setShowCreateForm(true);
            }}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 mx-auto"
          >
            <span>✏️</span> + New Note
          </button>
        </div>

        {/* Create/Edit Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in duration-150">
              <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingNoteId ? 'Edit Note' : 'Create a Note'}
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold p-1 leading-none"
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmitNote} className="p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder="Note title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Content
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-y transition-colors"
                    placeholder="Note content..."
                    required
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Attachment Manager in Modal */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <AttachmentManager
                    existingAttachments={activeNoteAttachments}
                    pendingFiles={pendingFiles}
                    onPendingFilesChange={setPendingFiles}
                    onDeleteExisting={handleDeleteAttachment}
                    onPreview={(att) => handleOpenPreview(editingNoteId, att)}
                    onDownload={(att) =>
                      handleDownloadAttachment(editingNoteId, att)
                    }
                    canEdit={true}
                    isUploading={creatingNote}
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingNote}
                    className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {creatingNote
                      ? editingNoteId
                        ? 'Saving...'
                        : 'Creating & Uploading...'
                      : editingNoteId
                      ? 'Save Changes'
                      : 'Create Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notes Grid */}
        <section className="space-y-4 pt-2">
          {loading ? (
            <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
              <div className="text-3xl mb-2 animate-spin">⏳</div>
              Loading notes...
            </div>
          ) : notes.length === 0 && !searchTerm ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-5xl mb-4">📝</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No notes here yet
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
                Capture your ideas, study notes, tasks, attach files, and share securely.
              </p>
              <button
                onClick={() => {
                  handleCancelEdit();
                  setShowCreateForm(true);
                }}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                Create your first note
              </button>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No matching notes found
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
                Try selecting a different filter or clearing your search query.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                }}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredNotes.map((note) => {
                const isOwner = Boolean(note.isOwner);
                const canEdit = isOwner || note.userPermission === 'edit';
                const imageAttachments = (note.attachments || []).filter(
                  (a) =>
                    ['.jpg', '.jpeg', '.png', '.webp'].some((ext) =>
                      a.originalName.toLowerCase().endsWith(ext)
                    ) || a.mimeType?.startsWith('image/')
                );
                const docAttachments = (note.attachments || []).filter(
                  (a) => !imageAttachments.includes(a)
                );

                return (
                  <div
                    key={note._id}
                    className={`p-4 border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800 flex flex-col justify-between ${
                      note.pinned
                        ? 'border-yellow-400/80 dark:border-yellow-500/60 ring-1 ring-yellow-400/30'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div>
                      {/* Card Header Badges */}
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {note.pinned && (
                            <span
                              className="text-yellow-500 text-base flex-shrink-0"
                              title="Pinned"
                            >
                              📌
                            </span>
                          )}
                          <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white truncate">
                            {note.title}
                          </h3>
                        </div>

                        {!isOwner && (
                          <span
                            className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 flex-shrink-0"
                            title={`Shared by ${note.sharedBy || 'collaborator'}`}
                          >
                            Shared ({canEdit ? 'Can Edit' : 'View Only'})
                          </span>
                        )}
                      </div>

                      {/* Content Preview */}
                      <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-3 line-clamp-3 break-words">
                        {note.content}
                      </p>

                      {/* Image Thumbnails (if any) */}
                      {imageAttachments.length > 0 && (
                        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {imageAttachments.map((img) => (
                            <div
                              key={img._id}
                              onClick={() => handleOpenPreview(note._id, img)}
                              className="w-16 h-16 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-85 transition-opacity bg-gray-100 dark:bg-gray-900 relative group"
                              title={`Preview ${img.originalName}`}
                            >
                              <img
                                src={`http://localhost:5000/api/notes/${note._id}/attachments/${img._id}/preview`}
                                alt={img.originalName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Document Attachment Chips */}
                      {docAttachments.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {docAttachments.slice(0, 3).map((doc) => (
                            <button
                              key={doc._id}
                              type="button"
                              onClick={() => handleOpenPreview(note._id, doc)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-[11px] truncate max-w-[180px] transition-colors"
                              title={`${doc.originalName} (${formatBytes(doc.size)}) - Click to preview/download`}
                            >
                              <span>{getFileIcon(doc.originalName, doc.mimeType)}</span>
                              <span className="truncate">{doc.originalName}</span>
                            </button>
                          ))}
                          {docAttachments.length > 3 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-gray-400">
                              +{docAttachments.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div>
                      <div className="flex justify-between items-center pt-2.5 border-t border-gray-100 dark:border-gray-700/50 text-xs">
                        <div className="flex gap-2 items-center flex-wrap">
                          <span className="inline-block px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-[11px] font-medium">
                            {note.category || 'General'}
                          </span>
                          <span
                            className="text-[11px] text-gray-400 flex items-center gap-1"
                            title={
                              note.updatedAt
                                ? new Date(note.updatedAt).toLocaleString()
                                : ''
                            }
                          >
                            <span>⏱️</span>
                            {getTimeAgo(note.updatedAt || note.createdAt)}
                          </span>
                        </div>

                        {note.attachments && note.attachments.length > 0 && (
                          <span
                            className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1"
                            title={`${note.attachments.length} attachment(s)`}
                          >
                            <span>📎</span>
                            {note.attachments.length}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-1.5 mt-3 pt-2 items-center justify-between border-t border-gray-100 dark:border-gray-700/30">
                        <div className="flex gap-1 items-center">
                          {isOwner && (
                            <button
                              onClick={() => handleTogglePin(note._id)}
                              className={`p-1.5 rounded transition-colors text-xs ${
                                note.pinned
                                  ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-gray-700'
                                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-yellow-500'
                              }`}
                              title={note.pinned ? 'Unpin note' : 'Pin note'}
                            >
                              📌
                            </button>
                          )}
                          {isOwner && (
                            <button
                              onClick={() => setSharingNote(note)}
                              className="px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors flex items-center gap-1"
                              title="Share note with others"
                            >
                              <span>👥</span> Share
                            </button>
                          )}
                        </div>

                        <div className="flex gap-1 items-center">
                          {canEdit && (
                            <button
                              onClick={() => handleStartEdit(note)}
                              className="px-2.5 py-1 text-xs font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {isOwner && (
                            <button
                              onClick={() => handleDeleteNote(note._id)}
                              className="px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Share Modal */}
      {sharingNote && (
        <ShareModal
          note={sharingNote}
          token={token}
          onClose={() => setSharingNote(null)}
          onUpdate={fetchNotes}
        />
      )}

      {/* Attachment Preview Modal */}
      {previewData && (
        <AttachmentPreviewModal
          attachment={previewData.attachment}
          previewUrl={`http://localhost:5000/api/notes/${previewData.noteId}/attachments/${previewData.attachment._id}/preview`}
          downloadUrl={`http://localhost:5000/api/notes/${previewData.noteId}/attachments/${previewData.attachment._id}/download`}
          onClose={() => setPreviewData(null)}
        />
      )}
    </div>
  );
}

export default NotesPage;
