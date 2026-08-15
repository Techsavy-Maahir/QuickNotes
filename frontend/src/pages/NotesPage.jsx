import { useState, useEffect } from 'react';
import axios from 'axios';

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
        selectedCategory && selectedCategory !== '__pinned__'
          ? { category: selectedCategory }
          : {};
      const response = await axios.get('http://localhost:5000/api/notes', {
        headers,
        params,
      });
      const notesWithPinned = response.data.map((note) => ({
        ...note,
        pinned: Boolean(note.pinned),
      }));
      setNotes(notesWithPinned);
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
      const searchLower = searchTerm.toLowerCase();
      const noteTitle = (note.title || '').toLowerCase();
      const noteContent = (note.content || '').toLowerCase();
      return noteTitle.includes(searchLower) || noteContent.includes(searchLower);
    })
    .sort((a, b) => {
      // Pinned notes first, then by date descending
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
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
        prevNotes.map((note) => (note._id === noteId ? updatedNote : note))
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
      if (editingNoteId) {
        await axios.put(
          `http://localhost:5000/api/notes/${editingNoteId}`,
          {
            title,
            content,
            category,
          },
          { headers }
        );
        setEditingNoteId(null);
      } else {
        await axios.post(
          'http://localhost:5000/api/notes',
          {
            title,
            content,
            category,
          },
          { headers }
        );
      }
      setTitle('');
      setContent('');
      setCategory('General');
      setShowCreateForm(false);
      setError('');
      fetchNotes();
    } catch (err) {
      setError(editingNoteId ? 'Failed to update note' : 'Failed to create note');
      setTimeout(() => setError(''), 3000);
    } finally {
      setCreatingNote(false);
    }
  };

  const handleStartEdit = (note) => {
    setEditingNoteId(note._id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category || 'General');
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setCategory('General');
    setShowCreateForm(false);
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
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

  // Extract any unique categories present in the notes that aren't in default list
  const existingCategories = Array.from(
    new Set([...categories, ...notes.map((n) => n.category).filter(Boolean)])
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 transition-colors duration-300">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span>🔒</span> Secure Notes
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

        {/* 2. Greeting Section */}
        <div className="py-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            {getGreeting()} 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg mt-2">
            Your thoughts, organized.
          </p>
        </div>

        {/* 3. Search Bar UI */}
        <div>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search your notes..."
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

        {/* 4. Filter Pills (UI & Category Filtering) */}
        <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === ''
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All
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

        {/* 5. Prominent "+ New Note" Button */}
        <div className="text-center py-4">
          <button
            onClick={() => {
              handleCancelEdit();
              setShowCreateForm(true);
            }}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            + New Note
          </button>
        </div>

        {/* 1. Create/Edit Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
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
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-y transition-colors"
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

                <div className="flex items-center justify-end space-x-3 pt-3">
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
                    className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                  >
                    {creatingNote
                      ? editingNoteId
                        ? 'Saving...'
                        : 'Creating...'
                      : editingNoteId
                      ? 'Save Changes'
                      : 'Create Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. Notes Display / Grid */}
        <section className="space-y-4 pt-2">
          {loading ? (
            <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
              Loading notes...
            </div>
          ) : notes.length === 0 && !searchTerm ? (
            /* No Notes At All */
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-5xl mb-4">📝</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No notes here yet
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
                Capture your ideas, study notes, tasks, and everything in between.
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
          ) : searchTerm && filteredNotes.length === 0 ? (
            /* No Search Results */
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No notes found for "{searchTerm}"
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
                Try a different search term or create a new note.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                >
                  Clear search
                </button>
                <button
                  onClick={() => {
                    handleCancelEdit();
                    setShowCreateForm(true);
                  }}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  Create new note
                </button>
              </div>
            </div>
          ) : selectedCategory === '__pinned__' && filteredNotes.length === 0 && !searchTerm ? (
            /* No Pinned Notes */
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-5xl mb-4">📌</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No pinned notes yet
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
                Pin important notes to keep them at the top of your list.
              </p>
              <button
                onClick={() => setSelectedCategory('')}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                View all notes
              </button>
            </div>
          ) : selectedCategory && selectedCategory !== '__pinned__' && filteredNotes.length === 0 && !searchTerm ? (
            /* No Notes in Selected Category */
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="text-5xl mb-4">🏷️</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                No notes in "{selectedCategory}"
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
                Create a new note in this category or try a different one.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={() => setSelectedCategory('')}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                >
                  View all notes
                </button>
                <button
                  onClick={() => {
                    handleCancelEdit();
                    setShowCreateForm(true);
                  }}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  Create new note
                </button>
              </div>
            </div>
          ) : (
            /* 7. Grid of Filtered & Pinned Note Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => (
                <div
                  key={note._id}
                  className={`p-4 border rounded-lg shadow-md hover:shadow-lg transition-all duration-200 bg-white dark:bg-gray-800 flex flex-col justify-between ${
                    note.pinned
                      ? 'border-yellow-400/80 dark:border-yellow-500/60 ring-1 ring-yellow-400/30'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        {note.pinned && (
                          <span
                            className="text-yellow-500 text-lg flex-shrink-0"
                            title="Pinned"
                          >
                            📌
                          </span>
                        )}
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white break-words">
                          {note.title}
                        </h3>
                      </div>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2 break-words">
                      {note.content ? (
                        note.content.length > 100
                          ? `${note.content.substring(0, 100)}...`
                          : note.content
                      ) : (
                        ''
                      )}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700/50">
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                          {note.category || 'General'}
                        </span>
                        <span
                          className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"
                          title={note.updatedAt ? new Date(note.updatedAt).toLocaleString() : ''}
                        >
                          <span>⏱️</span>
                          Updated {getTimeAgo(note.updatedAt || note.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 pt-2 items-center">
                      <button
                        onClick={() => handleTogglePin(note._id)}
                        className={`text-sm px-3 py-1 rounded transition-colors ${
                          note.pinned
                            ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-gray-700'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-yellow-500'
                        }`}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        📌
                      </button>
                      <button
                        onClick={() => handleStartEdit(note)}
                        className="text-sm px-3 py-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note._id)}
                        className="text-sm px-3 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default NotesPage;


