require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");

const User = require("./models/User");
const Note = require("./models/Note");
const authMiddleware = require("./middleware/auth");
const {
  validateUploadedFile,
  MAX_FILE_SIZE,
  MAX_ATTACHMENTS_PER_NOTE,
  MAX_FILES_PER_UPLOAD,
} = require("./config/uploadConfig");
const storageService = require("./services/storageService");
const {
  isNoteOwner,
  canViewNote,
  canEditNote,
  getUserPermission,
} = require("./utils/permissions");

const app = express();

app.use(cors());
app.use(express.json());

// Configure Multer for in-memory file buffering prior to storage validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_UPLOAD,
  },
});

// Simple in-memory rate limiter for public share link resolution to prevent brute-force
const rateLimitMap = new Map();
function rateLimitShareLinks(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "global";
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60; // 60 requests per minute

  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count += 1;
  }
  rateLimitMap.set(ip, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      message: "Too many requests. Please try again later.",
    });
  }
  next();
}

// Clean up old rate limit records periodically
const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);
if (rateLimitCleanup.unref) {
  rateLimitCleanup.unref();
}

// Helper to hash raw share tokens
function hashShareToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Helper to resolve note from share token
async function resolveSharedNote(token) {
  if (!token || typeof token !== "string" || token.length < 16) {
    return null;
  }
  const tokenHash = hashShareToken(token);
  let note = await Note.findOne({
    "shareLink.tokenHash": tokenHash,
    "shareLink.enabled": true,
  });

  if (!note) return null;

  if (typeof note.populate === "function") {
    await note.populate("userId", "email");
  }

  // Check expiration
  if (note.shareLink.expiresAt && new Date() > note.shareLink.expiresAt) {
    return { expired: true, note };
  }

  return { note, permission: note.shareLink.permission || "view" };
}

// ======================
// Connect to MongoDB
// ======================

if (process.env.MONGODB_URI && process.env.NODE_ENV !== "test") {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log("✅ MongoDB connected");
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
    });
} else if (process.env.NODE_ENV !== "test") {
  console.warn("⚠️ MONGODB_URI not provided. Skipping automatic connection.");
}

// ======================
// Health / Test Route
// ======================

app.get("/api/test", (req, res) => {
  res.json({
    message: "Server is working",
    storageProvider: storageService.isS3Configured() ? "s3" : "local",
  });
});

// ======================
// Auth Routes
// ======================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email: normalizedEmail,
      password: hashedPassword,
    });

    await user.save();

    res.json({
      message: "Registered",
      userId: user._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      userId: user._id,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/protected", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Access Granted",
    userId: req.userId,
  });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================
// Note CRUD Routes
// ======================

// Create Note
app.post("/api/notes", authMiddleware, async (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const note = new Note({
      title,
      content,
      category: category || "General",
      userId: req.userId,
    });

    await note.save();

    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get User's Own Notes
app.get("/api/notes", authMiddleware, async (req, res) => {
  try {
    const { category } = req.query;

    const filter = {
      userId: req.userId,
    };

    if (category) {
      filter.category = category;
    }

    const notes = await Note.find(filter)
      .populate("userId", "email")
      .sort({ createdAt: -1 });

    const notesWithRole = notes.map((note) => {
      const obj = note.toObject();
      obj.isOwner = true;
      obj.userPermission = "owner";
      return obj;
    });

    res.status(200).json(notesWithRole);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Get Notes Shared With Authenticated User
app.get("/api/notes/shared-with-me", authMiddleware, async (req, res) => {
  try {
    const notes = await Note.find({
      "collaborators.userId": req.userId,
    })
      .populate("userId", "email")
      .sort({ updatedAt: -1 });

    const notesWithRole = notes.map((note) => {
      const obj = note.toObject();
      const collaborator = note.collaborators.find(
        (c) => c.userId.toString() === req.userId.toString()
      );
      obj.isOwner = false;
      obj.userPermission = collaborator ? collaborator.permission : "view";
      obj.sharedBy = note.userId ? note.userId.email : "Unknown";
      return obj;
    });

    res.status(200).json(notesWithRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Single Note
app.get("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id).populate("userId", "email");

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (!canViewNote(note, req.userId)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    const permission = getUserPermission(note, req.userId);
    const noteObj = note.toObject();
    noteObj.userPermission = permission;
    noteObj.isOwner = isNoteOwner(note, req.userId);

    res.status(200).json(noteObj);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Update Note (Owner or Editor Collaborator)
app.put("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (!canEditNote(note, req.userId)) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to edit this note",
      });
    }

    const { title, content, category } = req.body;

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (category !== undefined) note.category = category;
    note.updatedAt = Date.now();

    await note.save();

    const noteObj = note.toObject();
    noteObj.userPermission = getUserPermission(note, req.userId);
    noteObj.isOwner = isNoteOwner(note, req.userId);

    res.json(noteObj);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Delete Note (Owner Only, cleans up stored attachments)
app.delete("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (!isNoteOwner(note, req.userId)) {
      return res.status(403).json({
        message: "Forbidden: Only the note owner can delete this note",
      });
    }

    // Clean up all stored files
    if (Array.isArray(note.attachments) && note.attachments.length > 0) {
      const storageKeys = note.attachments.map((a) => a.storageKey);
      await storageService.deleteMultipleFiles(storageKeys);
    }

    await Note.findByIdAndDelete(req.params.id);

    res.json({
      message: "Note deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Toggle Pin Note (Owner Only)
app.put("/api/notes/:id/pin", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (!isNoteOwner(note, req.userId)) {
      return res.status(403).json({
        message: "Forbidden: Only the owner can pin this note",
      });
    }

    note.pinned = !note.pinned;
    await note.save();

    res.json(note);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ======================
// Attachment Routes
// ======================

// Upload Attachments (Owner or Editor Collaborator)
app.post(
  "/api/notes/:id/attachments",
  authMiddleware,
  upload.array("files", MAX_FILES_PER_UPLOAD),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const note = await Note.findById(req.params.id);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      if (!canEditNote(note, req.userId)) {
        return res.status(403).json({
          message: "Forbidden: You do not have permission to attach files to this note",
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const currentCount = note.attachments ? note.attachments.length : 0;
      if (currentCount + req.files.length > MAX_ATTACHMENTS_PER_NOTE) {
        return res.status(400).json({
          message: `Cannot exceed limit of ${MAX_ATTACHMENTS_PER_NOTE} attachments per note (current: ${currentCount})`,
        });
      }

      // Validate all files first before writing
      for (const file of req.files) {
        const validation = validateUploadedFile(file);
        if (!validation.valid) {
          return res.status(400).json({
            message: `${file.originalname}: ${validation.message}`,
          });
        }
      }

      const addedAttachments = [];

      for (const file of req.files) {
        const validation = validateUploadedFile(file);
        const { storageKey } = await storageService.uploadFile({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: validation.mimeType,
        });

        const newAttachment = {
          _id: new mongoose.Types.ObjectId(),
          originalName: file.originalname,
          storageKey,
          mimeType: validation.mimeType,
          size: file.size,
          uploadedBy: req.userId,
          uploadedAt: new Date(),
        };

        note.attachments.push(newAttachment);
        addedAttachments.push(newAttachment);
      }

      note.updatedAt = Date.now();
      await note.save();

      res.status(201).json({
        message: "Attachments uploaded successfully",
        attachments: note.attachments,
        added: addedAttachments,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Preview Attachment (Owner or Collaborator)
app.get(
  "/api/notes/:id/attachments/:attachmentId/preview",
  authMiddleware,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const note = await Note.findById(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });

      if (!canViewNote(note, req.userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const attachment = note.attachments.id(req.params.attachmentId);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const fileData = await storageService.getFileStream(attachment.storageKey);

      res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(attachment.originalName)}"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (fileData.contentLength) {
        res.setHeader("Content-Length", fileData.contentLength);
      }

      fileData.stream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Download Attachment (Owner or Collaborator)
app.get(
  "/api/notes/:id/attachments/:attachmentId/download",
  authMiddleware,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const note = await Note.findById(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });

      if (!canViewNote(note, req.userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const attachment = note.attachments.id(req.params.attachmentId);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const fileData = await storageService.getFileStream(attachment.storageKey);

      res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (fileData.contentLength) {
        res.setHeader("Content-Length", fileData.contentLength);
      }

      fileData.stream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Delete Attachment (Owner or Editor Collaborator)
app.delete(
  "/api/notes/:id/attachments/:attachmentId",
  authMiddleware,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const note = await Note.findById(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });

      if (!canEditNote(note, req.userId)) {
        return res.status(403).json({
          message: "Forbidden: You do not have permission to delete attachments from this note",
        });
      }

      const attachment = note.attachments.id(req.params.attachmentId);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      // Remove from storage
      await storageService.deleteFile(attachment.storageKey);

      // Remove subdocument
      note.attachments.pull({ _id: req.params.attachmentId });
      note.updatedAt = Date.now();
      await note.save();

      res.json({
        message: "Attachment deleted successfully",
        attachments: note.attachments,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ======================
// Note Sharing (Registered Users)
// ======================

// Share Note with Registered User (Owner Only)
app.post("/api/notes/:id/share", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const { email, permission = "view" } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Recipient email is required" });
    }

    if (!["view", "edit"].includes(permission)) {
      return res.status(400).json({ message: "Permission must be 'view' or 'edit'" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (!isNoteOwner(note, req.userId)) {
      return res.status(403).json({
        message: "Forbidden: Only the note owner can manage collaborators",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const recipientUser = await User.findOne({ email: normalizedEmail });

    if (!recipientUser) {
      return res.status(404).json({
        message: "No registered user found with that email address",
      });
    }

    if (recipientUser._id.toString() === req.userId.toString()) {
      return res.status(400).json({
        message: "You cannot share a note with yourself",
      });
    }

    // Check if user is already a collaborator
    const existingIndex = note.collaborators.findIndex(
      (c) => c.userId.toString() === recipientUser._id.toString()
    );

    if (existingIndex >= 0) {
      // Update permission
      note.collaborators[existingIndex].permission = permission;
    } else {
      note.collaborators.push({
        userId: recipientUser._id,
        email: recipientUser.email,
        permission,
        addedAt: new Date(),
      });
    }

    await note.save();

    res.json({
      message: "Note shared successfully",
      collaborators: note.collaborators,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List Collaborators (Owner or Collaborator)
app.get("/api/notes/:id/collaborators", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (!canViewNote(note, req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(note.collaborators || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Collaborator Permission (Owner Only)
app.put(
  "/api/notes/:id/collaborators/:targetUserId",
  authMiddleware,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const { permission } = req.body;
      if (!["view", "edit"].includes(permission)) {
        return res.status(400).json({ message: "Permission must be 'view' or 'edit'" });
      }

      const note = await Note.findById(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });

      if (!isNoteOwner(note, req.userId)) {
        return res.status(403).json({ message: "Forbidden: Only note owner can update permissions" });
      }

      const collaborator = note.collaborators.find(
        (c) => c.userId.toString() === req.params.targetUserId
      );

      if (!collaborator) {
        return res.status(404).json({ message: "Collaborator not found on this note" });
      }

      collaborator.permission = permission;
      await note.save();

      res.json({
        message: "Collaborator permission updated",
        collaborators: note.collaborators,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Revoke Collaborator Access (Owner or Collaborator removing self)
app.delete(
  "/api/notes/:id/collaborators/:targetUserId",
  authMiddleware,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }

      const note = await Note.findById(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });

      const isOwner = isNoteOwner(note, req.userId);
      const isSelf = req.params.targetUserId === req.userId.toString();

      if (!isOwner && !isSelf) {
        return res.status(403).json({
          message: "Forbidden: You cannot remove this collaborator",
        });
      }

      note.collaborators = note.collaborators.filter(
        (c) => c.userId.toString() !== req.params.targetUserId
      );

      await note.save();

      res.json({
        message: "Collaborator removed",
        collaborators: note.collaborators,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ======================
// Shareable Link Management (Owner Only)
// ======================

// Create or Update Shareable Link
app.post("/api/notes/:id/share-link", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const { permission = "view", expiresInHours = null } = req.body;
    if (!["view", "edit"].includes(permission)) {
      return res.status(400).json({ message: "Permission must be 'view' or 'edit'" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (!isNoteOwner(note, req.userId)) {
      return res.status(403).json({
        message: "Forbidden: Only the note owner can manage shareable links",
      });
    }

    // Generate cryptographically secure random token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashShareToken(rawToken);

    let expiresAt = null;
    if (expiresInHours && !isNaN(Number(expiresInHours)) && Number(expiresInHours) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInHours) * 3600 * 1000);
    }

    note.shareLink = {
      enabled: true,
      tokenHash,
      permission,
      expiresAt,
      createdAt: new Date(),
    };

    await note.save();

    res.json({
      message: "Shareable link created",
      token: rawToken, // Returned ONLY on creation/refresh
      shareLink: {
        enabled: true,
        permission,
        expiresAt,
        createdAt: note.shareLink.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Current Shareable Link Status
app.get("/api/notes/:id/share-link", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (!isNoteOwner(note, req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const isExpired =
      note.shareLink?.expiresAt && new Date() > note.shareLink.expiresAt;

    res.json({
      enabled: Boolean(note.shareLink?.enabled),
      permission: note.shareLink?.permission || "view",
      expiresAt: note.shareLink?.expiresAt || null,
      createdAt: note.shareLink?.createdAt || null,
      isExpired: Boolean(isExpired),
      hasActiveLink: Boolean(note.shareLink?.enabled && !isExpired),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Revoke Shareable Link
app.delete("/api/notes/:id/share-link", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (!isNoteOwner(note, req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    note.shareLink = {
      enabled: false,
      tokenHash: null,
      permission: "view",
      expiresAt: null,
      createdAt: null,
    };

    await note.save();

    res.json({
      message: "Share link revoked successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ======================
// Public Access via Shareable Link
// ======================

// Access Shared Note via Token
app.get("/api/shared/notes/:token", rateLimitShareLinks, async (req, res) => {
  try {
    const resolved = await resolveSharedNote(req.params.token);

    if (!resolved) {
      return res.status(404).json({
        message: "Invalid or inactive share link",
      });
    }

    if (resolved.expired) {
      return res.status(410).json({
        message: "This share link has expired",
      });
    }

    const { note, permission } = resolved;

    res.json({
      _id: note._id,
      title: note.title,
      content: note.content,
      category: note.category,
      attachments: (note.attachments || []).map((a) => ({
        _id: a._id,
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
        uploadedAt: a.uploadedAt,
      })),
      permission,
      ownerEmail: note.userId ? note.userId.email : "Shared User",
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Shared Note via Token (if link permission is 'edit')
app.put("/api/shared/notes/:token", rateLimitShareLinks, async (req, res) => {
  try {
    const resolved = await resolveSharedNote(req.params.token);

    if (!resolved) {
      return res.status(404).json({ message: "Invalid or inactive share link" });
    }

    if (resolved.expired) {
      return res.status(410).json({ message: "This share link has expired" });
    }

    if (resolved.permission !== "edit") {
      return res.status(403).json({
        message: "Forbidden: This share link grants view-only access",
      });
    }

    const { note } = resolved;
    const { title, content } = req.body;

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    note.updatedAt = Date.now();

    await note.save();

    res.json({
      message: "Note updated successfully",
      note: {
        _id: note._id,
        title: note.title,
        content: note.content,
        category: note.category,
        updatedAt: note.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Preview Attachment via Share Link
app.get(
  "/api/shared/notes/:token/attachments/:attachmentId/preview",
  rateLimitShareLinks,
  async (req, res) => {
    try {
      const resolved = await resolveSharedNote(req.params.token);
      if (!resolved || resolved.expired) {
        return res.status(404).json({ message: "Invalid or expired share link" });
      }

      const { note } = resolved;
      const attachment = note.attachments.id(req.params.attachmentId);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const fileData = await storageService.getFileStream(attachment.storageKey);

      res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(attachment.originalName)}"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (fileData.contentLength) {
        res.setHeader("Content-Length", fileData.contentLength);
      }

      fileData.stream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Download Attachment via Share Link
app.get(
  "/api/shared/notes/:token/attachments/:attachmentId/download",
  rateLimitShareLinks,
  async (req, res) => {
    try {
      const resolved = await resolveSharedNote(req.params.token);
      if (!resolved || resolved.expired) {
        return res.status(404).json({ message: "Invalid or expired share link" });
      }

      const { note } = resolved;
      const attachment = note.attachments.id(req.params.attachmentId);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const fileData = await storageService.getFileStream(attachment.storageKey);

      res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (fileData.contentLength) {
        res.setHeader("Content-Length", fileData.contentLength);
      }

      fileData.stream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Error Handling Middleware for Multer and uncaught errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: `File exceeds maximum size limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: `Cannot upload more than ${MAX_FILES_PER_UPLOAD} files at once`,
      });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err) {
    console.error("Unhandled error:", err.message);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
  next();
});

// ======================
// Start Server
// ======================

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;