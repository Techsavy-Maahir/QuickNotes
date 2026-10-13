function isNoteOwner(note, userId) {
  if (!note || !userId) return false;
  const noteOwnerId = note.userId?._id ? note.userId._id.toString() : note.userId.toString();
  return noteOwnerId === userId.toString();
}

function canViewNote(note, userId) {
  if (!note || !userId) return false;
  if (isNoteOwner(note, userId)) return true;

  if (Array.isArray(note.collaborators)) {
    return note.collaborators.some(
      (c) => c.userId && c.userId.toString() === userId.toString()
    );
  }
  return false;
}

function canEditNote(note, userId) {
  if (!note || !userId) return false;
  if (isNoteOwner(note, userId)) return true;

  if (Array.isArray(note.collaborators)) {
    return note.collaborators.some(
      (c) =>
        c.userId &&
        c.userId.toString() === userId.toString() &&
        c.permission === 'edit'
    );
  }
  return false;
}

function getUserPermission(note, userId) {
  if (!note || !userId) return null;
  if (isNoteOwner(note, userId)) return 'owner';

  if (Array.isArray(note.collaborators)) {
    const collaborator = note.collaborators.find(
      (c) => c.userId && c.userId.toString() === userId.toString()
    );
    if (collaborator) return collaborator.permission;
  }
  return null;
}

module.exports = {
  isNoteOwner,
  canViewNote,
  canEditNote,
  getUserPermission,
};
