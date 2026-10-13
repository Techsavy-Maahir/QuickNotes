import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ShareModal({ note, token, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('collaborators'); // 'collaborators' | 'link'

  // Collaborator State
  const [collaborators, setCollaborators] = useState(note?.collaborators || []);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('view');
  const [loadingCollab, setLoadingCollab] = useState(false);
  const [collabMessage, setCollabMessage] = useState({ text: '', type: '' });

  // Share Link State
  const [linkData, setLinkData] = useState(null);
  const [generatedToken, setGeneratedToken] = useState('');
  const [linkPermission, setLinkPermission] = useState('view');
  const [expiresInHours, setExpiresInHours] = useState('never');
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkMessage, setLinkMessage] = useState({ text: '', type: '' });
  const [copied, setCopied] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch share link status on mount
  useEffect(() => {
    const fetchLinkStatus = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/api/notes/${note._id}/share-link`,
          { headers }
        );
        setLinkData(response.data);
        if (response.data.permission) {
          setLinkPermission(response.data.permission);
        }
      } catch (err) {
        console.error('Failed to load share link status', err);
      }
    };

    if (note?._id) {
      fetchLinkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?._id]);

  // Handle Share with registered user
  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoadingCollab(true);
    setCollabMessage({ text: '', type: '' });

    try {
      const response = await axios.post(
        `http://localhost:5000/api/notes/${note._id}/share`,
        { email: email.trim(), permission },
        { headers }
      );
      setCollaborators(response.data.collaborators);
      setEmail('');
      setCollabMessage({
        text: `Shared with ${email} (${permission === 'edit' ? 'Can edit' : 'Can view'})`,
        type: 'success',
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to share note';
      setCollabMessage({ text: msg, type: 'error' });
    } finally {
      setLoadingCollab(false);
      setTimeout(() => setCollabMessage({ text: '', type: '' }), 4000);
    }
  };

  // Update collaborator permission
  const handleUpdatePermission = async (userId, newPerm) => {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/notes/${note._id}/collaborators/${userId}`,
        { permission: newPerm },
        { headers }
      );
      setCollaborators(response.data.collaborators);
      setCollabMessage({ text: 'Permission updated', type: 'success' });
      if (onUpdate) onUpdate();
    } catch (err) {
      setCollabMessage({ text: 'Failed to update permission', type: 'error' });
    } finally {
      setTimeout(() => setCollabMessage({ text: '', type: '' }), 3000);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (userId) => {
    try {
      const response = await axios.delete(
        `http://localhost:5000/api/notes/${note._id}/collaborators/${userId}`,
        { headers }
      );
      setCollaborators(response.data.collaborators);
      setCollabMessage({ text: 'Collaborator removed', type: 'success' });
      if (onUpdate) onUpdate();
    } catch (err) {
      setCollabMessage({ text: 'Failed to remove collaborator', type: 'error' });
    } finally {
      setTimeout(() => setCollabMessage({ text: '', type: '' }), 3000);
    }
  };

  // Generate / Update Shareable Link
  const handleGenerateLink = async () => {
    setLoadingLink(true);
    setLinkMessage({ text: '', type: '' });

    const hours =
      expiresInHours === 'never'
        ? null
        : Number(expiresInHours);

    try {
      const response = await axios.post(
        `http://localhost:5000/api/notes/${note._id}/share-link`,
        {
          permission: linkPermission,
          expiresInHours: hours,
        },
        { headers }
      );

      setGeneratedToken(response.data.token);
      setLinkData({
        enabled: true,
        permission: linkPermission,
        expiresAt: response.data.shareLink.expiresAt,
        hasActiveLink: true,
      });

      setLinkMessage({
        text: 'Shareable link generated! Anyone with this link can access the note.',
        type: 'success',
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      setLinkMessage({ text: 'Failed to generate link', type: 'error' });
    } finally {
      setLoadingLink(false);
    }
  };

  // Revoke Shareable Link
  const handleRevokeLink = async () => {
    if (!window.confirm('Are you sure you want to revoke the shareable link? Existing links will no longer work.')) {
      return;
    }

    setLoadingLink(true);
    try {
      await axios.delete(
        `http://localhost:5000/api/notes/${note._id}/share-link`,
        { headers }
      );
      setGeneratedToken('');
      setLinkData({
        enabled: false,
        hasActiveLink: false,
        permission: 'view',
        expiresAt: null,
      });
      setLinkMessage({ text: 'Share link revoked', type: 'success' });
      if (onUpdate) onUpdate();
    } catch (err) {
      setLinkMessage({ text: 'Failed to revoke link', type: 'error' });
    } finally {
      setLoadingLink(false);
      setTimeout(() => setLinkMessage({ text: '', type: '' }), 3000);
    }
  };

  // Construct copy URL
  const currentShareUrl = generatedToken
    ? `${window.location.origin}/?share=${generatedToken}`
    : linkData?.hasActiveLink
    ? `${window.location.origin}/?share=[Existing Active Link - Click Refresh to Generate New]`
    : '';

  const handleCopy = () => {
    if (generatedToken) {
      const url = `${window.location.origin}/?share=${generatedToken}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>👥</span> Share Note
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-sm">
              "{note?.title}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold p-1 leading-none"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={() => setActiveTab('collaborators')}
            className={`flex-1 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'collaborators'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <span>👤</span> Collaborators ({collaborators.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'link'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <span>🔗</span> Shareable Link
            {linkData?.hasActiveLink && (
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            )}
          </button>
        </div>

        {/* Tab 1: Collaborators Content */}
        {activeTab === 'collaborators' && (
          <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
            {collabMessage.text && (
              <div
                className={`p-3 text-xs rounded-lg border ${
                  collabMessage.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
                    : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
                }`}
              >
                {collabMessage.text}
              </div>
            )}

            {/* Add Collaborator Form */}
            <form onSubmit={handleAddCollaborator} className="space-y-3">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Add People
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter registered user email"
                  required
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="px-2.5 py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="view">Can view</option>
                  <option value="edit">Can edit</option>
                </select>
                <button
                  type="submit"
                  disabled={loadingCollab}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {loadingCollab ? 'Sharing...' : 'Share'}
                </button>
              </div>
            </form>

            {/* Collaborator List */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                People with access
              </label>
              <div className="divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                {/* Note Owner Row */}
                <div className="p-3 flex items-center justify-between text-xs bg-gray-50/50 dark:bg-gray-750">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">👑</span>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {note?.userId?.email || 'You'}
                      </span>
                      <span className="ml-2 text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                        (Owner)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">Full Access</span>
                </div>

                {/* Collaborator Rows */}
                {collaborators.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
                    No collaborators added yet. Share this note by email above.
                  </div>
                ) : (
                  collaborators.map((c) => (
                    <div
                      key={c.userId}
                      className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="text-base">👤</span>
                        <div className="truncate">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {c.email}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Added {new Date(c.addedAt || Date.now()).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-auto">
                        <select
                          value={c.permission}
                          onChange={(e) =>
                            handleUpdatePermission(c.userId, e.target.value)
                          }
                          className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="view">Can view</option>
                          <option value="edit">Can edit</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(c.userId)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Revoke collaborator access"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Shareable Link Content */}
        {activeTab === 'link' && (
          <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
            {linkMessage.text && (
              <div
                className={`p-3 text-xs rounded-lg border ${
                  linkMessage.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
                    : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
                }`}
              >
                {linkMessage.text}
              </div>
            )}

            {/* Link Configuration */}
            <div className="bg-gray-50 dark:bg-gray-800/80 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                    Link Settings
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Anyone with the generated secret link can access this note.
                  </p>
                </div>
                {linkData?.hasActiveLink && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                    Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Permission
                  </label>
                  <select
                    value={linkPermission}
                    onChange={(e) => setLinkPermission(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="view">Can view only</option>
                    <option value="edit">Can edit content</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expiration
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="never">Never expires</option>
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours (1 Day)</option>
                    <option value="168">7 Days</option>
                    <option value="720">30 Days</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={loadingLink}
                  className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loadingLink
                    ? 'Generating...'
                    : linkData?.hasActiveLink
                    ? 'Refresh & Generate New Link'
                    : 'Generate Shareable Link'}
                </button>
              </div>
            </div>

            {/* Generated Link Display */}
            {generatedToken ? (
              <div className="space-y-2 p-3.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    Your Share Link is Ready:
                  </span>
                  {linkData?.expiresAt && (
                    <span className="text-[11px] text-blue-700 dark:text-blue-300">
                      Expires: {new Date(linkData.expiresAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?share=${generatedToken}`}
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-700 rounded text-gray-900 dark:text-white font-mono select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm transition-colors whitespace-nowrap"
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-blue-600 dark:text-blue-300">
                  ⚠️ Note: For your security, this raw secret link is displayed now. Copy and store it safely.
                </p>
              </div>
            ) : linkData?.hasActiveLink ? (
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    Status: Link Sharing Enabled
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 font-medium">
                    {linkData.permission === 'edit' ? 'Can Edit' : 'View Only'}
                  </span>
                </div>
                {linkData.expiresAt && (
                  <p className="text-gray-500 dark:text-gray-400">
                    Expires on: {new Date(linkData.expiresAt).toLocaleString()}
                  </p>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  To get a new copyable URL, click "Refresh & Generate New Link" above.
                </p>
              </div>
            ) : null}

            {/* Revoke Action */}
            {linkData?.hasActiveLink && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                <button
                  type="button"
                  onClick={handleRevokeLink}
                  disabled={loadingLink}
                  className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-medium rounded-lg transition-colors"
                >
                  Revoke Share Link
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end bg-gray-50/50 dark:bg-gray-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs sm:text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareModal;
