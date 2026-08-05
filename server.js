require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const authMiddleware = require("./middleware/auth");
const Note = require("./models/Note");
const app = express();

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

  app.get('/api/test', (req, res) => {
  res.json({
    message: "Server is working"
  });
});

// ======================
// Register Route
// ======================
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(400).json({
      message: 'User already exists'
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    email,
    password: hashedPassword
  });

  await user.save();

  res.json({
    message: 'Registered',
    userId: user._id
  });
});

app.post('/api/auth/login', async (req, res) => {

  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({
      message: "Invalid credentials"
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  
if (!isMatch) {
  return res.status(400).json({
    message: "Invalid credentials"
  });
}


  const token = jwt.sign(
    {userId : user._id},
    process.env.JWT_SECRET,
    {expiresIn : '7d'}
  );

  res.json({
    token,
    userId: user._id
  });

});
app.get('/api/protected', authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Access Granted",
    userId: req.userId
  });
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server is running on port ${process.env.PORT || 5000}`);
});