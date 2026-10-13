const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const attachmentSchema = new Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  storageKey: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const collaboratorSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  permission: {
    type: String,
    enum: ['view', 'edit'],
    default: 'view',
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const shareLinkSchema = new Schema({
  enabled: {
    type: Boolean,
    default: false,
  },
  tokenHash: {
    type: String,
    default: null,
  },
  permission: {
    type: String,
    enum: ['view', 'edit'],
    default: 'view',
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: null,
  },
});

const noteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    collaborators: {
      type: [collaboratorSchema],
      default: [],
    },
    shareLink: {
      type: shareLinkSchema,
      default: () => ({
        enabled: false,
        tokenHash: null,
        permission: 'view',
        expiresAt: null,
        createdAt: null,
      }),
    },
  },
  { timestamps: true }
);

noteSchema.index({ 'collaborators.userId': 1 });
noteSchema.index({ 'shareLink.tokenHash': 1 });

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;