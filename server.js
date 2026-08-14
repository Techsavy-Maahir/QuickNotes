require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Note = require("./models/Note");
const authMiddleware = require("./middleware/auth");

const app = express();

app.use(express.json());

// ======================
// Connect to MongoDB
// ======================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

// ======================
// Test Route
// ======================

app.get("/api/test", (req, res) => {
  res.json({
    message: "Server is working",
  });
});

// ======================
// Register Route
// ======================

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({
      message: "User already exists",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    email,
    password: hashedPassword,
  });

  await user.save();

  res.json({
    message: "Registered",
    userId: user._id,
  });
});

// ======================
// Login Route
// ======================

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

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
  });
});

// ======================
// Protected Route
// ======================

app.get("/api/protected", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Access Granted",
    userId: req.userId,
  });
});

// ======================
// Create Note
// ======================

app.post("/api/notes", authMiddleware, async (req, res) => {
  const { title, content, category } = req.body;

  const note = new Note({
    title,
    content,
    category: category || "General",
    userId: req.userId,
  });

  await note.save();

  res.json(note);
});

// ======================
// Get All Notes
// ======================

app.get("/api/notes", authMiddleware, async (req, res) => {
  try {
    const notes = await Note.find({
      userId: req.userId,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ======================
// Get Single Note
// ======================

app.get("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (note.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    res.status(200).json(note);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ======================
// Update Note
// ======================

app.put("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (note.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    const { title, content, category } = req.body;

    note.title = title || note.title;
    note.content = content || note.content;
    note.category = category || note.category;
    note.updatedAt = Date.now();

    await note.save();

    res.json(note);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// ======================
// Delete Note
// ======================

app.delete("/api/notes/:id", authMiddleware, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (note.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        message: "Forbidden",
      });
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

// ======================
// Start Server
// ======================

app.listen(process.env.PORT || 5000, () => {
  console.log(
    `Server is running on port ${process.env.PORT || 5000}`
  );
});