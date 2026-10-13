const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Set required env vars
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_123';
process.env.NODE_ENV = 'test';

const User = require('../models/User');
const Note = require('../models/Note');
const app = require('../server');
const storageService = require('../services/storageService');

test('QuickNotes API Endpoints Integration Test Suite', async (t) => {
  // Ephemeral in-memory database stores
  const usersDb = new Map();
  const notesDb = new Map();

  let nextUserId = 1;
  let nextNoteId = 1;

  function toObjectId(num) {
    return num.toString(16).padStart(24, '0');
  }

  // Helper document wrapper to mimic Mongoose documents
  function createNoteDoc(data) {
    const doc = {
      _id: data._id || toObjectId(nextNoteId++),
      userId: data.userId,
      title: data.title,
      content: data.content,
      category: data.category || 'General',
      pinned: Boolean(data.pinned),
      attachments: (data.attachments || []).map((a) => ({
        _id: a._id || toObjectId(Math.floor(Math.random() * 900000) + 100000),
        originalName: a.originalName,
        storageKey: a.storageKey,
        mimeType: a.mimeType,
        size: a.size,
        uploadedBy: a.uploadedBy,
        uploadedAt: a.uploadedAt || new Date(),
      })),
      collaborators: (data.collaborators || []).map((c) => ({
        userId: c.userId,
        email: c.email,
        permission: c.permission || 'view',
        addedAt: c.addedAt || new Date(),
      })),
      shareLink: data.shareLink || {
        enabled: false,
        tokenHash: null,
        permission: 'view',
        expiresAt: null,
        createdAt: null,
      },
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
      toObject() {
        return {
          _id: this._id,
          userId: this.userId,
          title: this.title,
          content: this.content,
          category: this.category,
          pinned: this.pinned,
          attachments: [...this.attachments],
          collaborators: [...this.collaborators],
          shareLink: { ...this.shareLink },
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
        };
      },
      async save() {
        this.updatedAt = new Date();
        notesDb.set(this._id.toString(), this);
        return this;
      },
    };

    doc.attachments.id = function (id) {
      return this.find((a) => a._id.toString() === id.toString()) || null;
    };
    doc.attachments.pull = function (query) {
      if (query._id) {
        const index = this.findIndex(
          (a) => a._id.toString() === query._id.toString()
        );
        if (index >= 0) this.splice(index, 1);
      }
    };

    return doc;
  }

  // Intercept Mongoose User model queries
  User.findOne = async function (filter) {
    if (filter.email) {
      for (const u of usersDb.values()) {
        if (u.email === filter.email.toLowerCase().trim()) return u;
      }
    }
    if (filter._id) {
      return usersDb.get(filter._id.toString()) || null;
    }
    return null;
  };

  User.findById = async function (id) {
    const u = usersDb.get(id ? id.toString() : '');
    if (!u) return null;
    return {
      _id: u._id,
      email: u.email,
      select: () => ({ _id: u._id, email: u.email }),
    };
  };

  User.prototype.save = async function () {
    if (!this._id) {
      this._id = toObjectId(nextUserId++);
    }
    usersDb.set(this._id.toString(), this);
    return this;
  };

  // Intercept Mongoose Note model queries
  Note.findById = async function (id) {
    const note = notesDb.get(id ? id.toString() : '');
    if (!note) return null;
    const clone = createNoteDoc(note);
    clone.populate = async function () {
      const owner = usersDb.get(this.userId.toString());
      if (owner) this.userId = { _id: owner._id, email: owner.email };
      return this;
    };
    return clone;
  };

  Note.find = function (filter = {}) {
    let result = Array.from(notesDb.values()).map(createNoteDoc);
    if (filter.userId) {
      result = result.filter(
        (n) => n.userId.toString() === filter.userId.toString()
      );
    }
    if (filter['collaborators.userId']) {
      result = result.filter((n) =>
        n.collaborators.some(
          (c) => c.userId.toString() === filter['collaborators.userId'].toString()
        )
      );
    }
    if (filter.category) {
      result = result.filter((n) => n.category === filter.category);
    }

    const queryObj = {
      populate: function () {
        result.forEach((n) => {
          const owner = usersDb.get(n.userId.toString());
          if (owner) n.userId = { _id: owner._id, email: owner.email };
        });
        return this;
      },
      sort: function () {
        return Promise.resolve(result);
      },
    };
    return queryObj;
  };

  Note.findOne = async function (filter = {}) {
    let list = Array.from(notesDb.values()).map(createNoteDoc);
    if (filter['shareLink.tokenHash']) {
      list = list.filter(
        (n) =>
          n.shareLink?.tokenHash === filter['shareLink.tokenHash'] &&
          n.shareLink?.enabled === filter['shareLink.enabled']
      );
    }
    const match = list[0] || null;
    if (match) {
      match.populate = async function () {
        const owner = usersDb.get(this.userId.toString());
        if (owner) this.userId = { _id: owner._id, email: owner.email };
        return this;
      };
    }
    return match;
  };

  Note.findByIdAndDelete = async function (id) {
    const exists = notesDb.get(id.toString());
    notesDb.delete(id.toString());
    return exists;
  };

  Note.prototype.save = async function () {
    if (!this._id) {
      this._id = toObjectId(nextNoteId++);
    }
    const doc = createNoteDoc(this);
    notesDb.set(this._id.toString(), doc);
    return doc;
  };

  // Start test server
  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  t.after(() => {
    if (server) server.close();
  });

  // State shared across test steps
  let tokenA, userAId;
  let tokenB, userBId;
  let createdNoteId;
  let attachmentId;
  let shareToken;

  // 1. User Registration & Login
  await t.test('POST /api/auth/register & /api/auth/login for User A and User B', async () => {
    // Register User A
    const regResA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@quicknotes.com', password: 'Password123!' }),
    });
    assert.strictEqual(regResA.status, 200);

    // Login User A
    const loginResA = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@quicknotes.com', password: 'Password123!' }),
    });
    const loginDataA = await loginResA.json();
    assert.ok(loginDataA.token);
    tokenA = loginDataA.token;
    userAId = loginDataA.userId;

    // Register & Login User B
    const regResB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@quicknotes.com', password: 'Password456!' }),
    });
    assert.strictEqual(regResB.status, 200);

    const loginResB = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@quicknotes.com', password: 'Password456!' }),
    });
    const loginDataB = await loginResB.json();
    assert.ok(loginDataB.token);
    tokenB = loginDataB.token;
    userBId = loginDataB.userId;
  });

  // 2. Note Creation
  await t.test('POST /api/notes creates note for User A', async () => {
    const res = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Project Roadmap',
        content: 'Quarterly development milestones and architecture specs.',
        category: 'Work',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data._id);
    assert.strictEqual(data.title, 'Project Roadmap');
    createdNoteId = data._id;
  });

  // 3. File Attachment Upload (PDF)
  await t.test('POST /api/notes/:id/attachments uploads supported PDF', async () => {
    const formData = new FormData();
    const pdfBlob = new Blob(['%PDF-1.4\nSpecification Doc\n%%EOF'], {
      type: 'application/pdf',
    });
    formData.append('files', pdfBlob, 'spec.pdf');

    const res = await fetch(`${baseUrl}/api/notes/${createdNoteId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.attachments.length, 1);
    assert.strictEqual(data.attachments[0].originalName, 'spec.pdf');
    attachmentId = data.attachments[0]._id;
  });

  // 4. Download and Preview Attachment
  await t.test('GET /api/notes/:id/attachments/:attId/preview & download streams file', async () => {
    const prevRes = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/attachments/${attachmentId}/preview`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.strictEqual(prevRes.status, 200);
    assert.strictEqual(prevRes.headers.get('content-type'), 'application/pdf');
    assert.ok(prevRes.headers.get('content-disposition').includes('inline'));

    const downRes = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/attachments/${attachmentId}/download`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.strictEqual(downRes.status, 200);
    assert.ok(downRes.headers.get('content-disposition').includes('attachment'));
  });

  // 5. Unauthorized User Access Rejection
  await t.test('User B (unauthorized) cannot download or upload to User A note', async () => {
    const getRes = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/attachments/${attachmentId}/download`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      }
    );
    assert.strictEqual(getRes.status, 403);

    const formData = new FormData();
    const txtBlob = new Blob(['intruder file'], { type: 'text/plain' });
    formData.append('files', txtBlob, 'attack.txt');

    const postRes = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/attachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: formData,
      }
    );
    assert.strictEqual(postRes.status, 403);
  });

  // 6. Share Note with Registered User (view permission)
  await t.test('POST /api/notes/:id/share shares note with User B as view-only', async () => {
    const res = await fetch(`${baseUrl}/api/notes/${createdNoteId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        email: 'bob@quicknotes.com',
        permission: 'view',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.collaborators.length, 1);
    assert.strictEqual(data.collaborators[0].email, 'bob@quicknotes.com');
    assert.strictEqual(data.collaborators[0].permission, 'view');
  });

  // 7. Authorized Recipient can View and Download
  await t.test('User B can view shared note and download its attachments', async () => {
    const listRes = await fetch(`${baseUrl}/api/notes/shared-with-me`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(listRes.status, 200);
    const list = await listRes.json();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0]._id, createdNoteId);
    assert.strictEqual(list[0].userPermission, 'view');

    // Download attachment now authorized
    const downRes = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/attachments/${attachmentId}/download`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      }
    );
    assert.strictEqual(downRes.status, 200);
  });

  // 8. View-only Collaborator Cannot Edit Note
  await t.test('User B (view permission) cannot edit note', async () => {
    const res = await fetch(`${baseUrl}/api/notes/${createdNoteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        title: 'Tampered Title',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  // 9. Update Collaborator Permission to 'edit'
  await t.test('User A upgrades User B permission to edit', async () => {
    const res = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/collaborators/${userBId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ permission: 'edit' }),
      }
    );
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.collaborators[0].permission, 'edit');
  });

  // 10. Editor Collaborator can now Edit Note
  await t.test('User B can now update note content with edit permission', async () => {
    const res = await fetch(`${baseUrl}/api/notes/${createdNoteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        content: 'Updated content collaboratively added by Bob.',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.content, 'Updated content collaboratively added by Bob.');
  });

  // 11. Cryptographic Shareable Link Generation
  await t.test('POST /api/notes/:id/share-link generates unguessable share link', async () => {
    const res = await fetch(`${baseUrl}/api/notes/${createdNoteId}/share-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        permission: 'view',
        expiresInHours: 24,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.strictEqual(data.token.length, 64); // 32-byte hex token
    shareToken = data.token;
  });

  // 12. Public Access via Share Link
  await t.test('Unauthenticated user can access note and attachments via share link', async () => {
    const res = await fetch(`${baseUrl}/api/shared/notes/${shareToken}`);
    assert.strictEqual(res.status, 200);
    const note = await res.json();
    assert.strictEqual(note.title, 'Project Roadmap');
    assert.strictEqual(note.permission, 'view');
    assert.strictEqual(note.attachments.length, 1);

    // Download attachment via share link
    const downRes = await fetch(
      `${baseUrl}/api/shared/notes/${shareToken}/attachments/${attachmentId}/download`
    );
    assert.strictEqual(downRes.status, 200);
  });

  // 13. Revoke Share Link
  await t.test('DELETE /api/notes/:id/share-link revokes access immediately', async () => {
    const revokeRes = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/share-link`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.strictEqual(revokeRes.status, 200);

    // Public access now rejected with 404
    const pubRes = await fetch(`${baseUrl}/api/shared/notes/${shareToken}`);
    assert.strictEqual(pubRes.status, 404);
  });

  // 14. Delete Attachment and Verify Storage Cleanup
  await t.test('DELETE /api/notes/:id/attachments/:attId deletes attachment and storage file', async () => {
    const res = await fetch(
      `${baseUrl}/api/notes/${createdNoteId}/attachments/${attachmentId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.attachments.length, 0);
  });

  // 15. Delete Note and Verify Cleanup
  await t.test('DELETE /api/notes/:id deletes note for owner only', async () => {
    // User B (collaborator) cannot delete note
    const forbiddenRes = await fetch(`${baseUrl}/api/notes/${createdNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(forbiddenRes.status, 403);

    // User A (owner) deletes note
    const deleteRes = await fetch(`${baseUrl}/api/notes/${createdNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(deleteRes.status, 200);
  });
});
