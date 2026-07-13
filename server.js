require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const app = express();

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is running!'
  });
});

app.post('/api/auth/register',async (req,res) =>{

  const { email, password } = req.body;

  const existingUser = await User.findOne({ email });

  if(existingUser) {
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
    message : "Registered",
    userId : user._id
  });
});

console.log("NEW SERVER CODE LOADED");

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server is running on port ${process.env.PORT || 5000}`);
});