const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const sendEmail = require('../utils/email');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user & Send OTP
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password, role, bloodType, location, phone } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      // User requested to check existence before sending OTP. 
      // We do not send OTP if user exists, even if unverified.
      return res.status(400).json({ message: 'User already exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins

    const user = await User.create({
      name,
      email,
      password,
      role,
      bloodType,
      location,
      phone,
      isVerified: false,
      otp,
      otpExpires
    });

    if (user) {
      await sendEmail({
        to: email,
        template: 'otp_verification',
        templateVars: { name, otp }
      });

      res.status(201).json({
        message: 'Registration successful. Please verify your email with the OTP sent.',
        email: user.email
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({ email }).select('+otp +otpExpires'); // Explicitly select hidden fields

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(200).json({ 
                message: 'User already verified',
                token: generateToken(user._id),
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
             });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP Expired' });
        }

        // OTP Valid
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({
            message: 'Email verified successfully',
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', async (req, res) => {
  const { userId, name, email, phone, location, bloodType, isAvailable } = req.body;

  try {
    const user = await User.findById(userId);

    if (user) {
      user.name = name || user.name;
      user.email = email || user.email;
      user.phone = phone || user.phone;
      user.location = location || user.location;
      user.bloodType = bloodType || user.bloodType;
      if (isAvailable !== undefined) user.isAvailable = isAvailable;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        location: updatedUser.location,
        bloodType: updatedUser.bloodType,
        isAvailable: updatedUser.isAvailable,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Toggle availability status
// @route   PATCH /api/auth/availability/:userId
// @access  Private
router.patch('/availability/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (user) {
      user.isAvailable = !user.isAvailable;
      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        isAvailable: updatedUser.isAvailable,
        message: `Availability updated to ${updatedUser.isAvailable ? 'available' : 'not available'}`,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (!user.isVerified) {
          // Send new OTP if not verified
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          user.otp = otp;
          user.otpExpires = Date.now() + 10 * 60 * 1000;
          await user.save();

          await sendEmail({
             to: email,
             template: 'otp_verification',
             templateVars: { name: user.name, otp }
          });

          return res.status(403).json({ 
              message: 'Email not verified. A new OTP has been sent to your email.',
              email: user.email,
              isUnverified: true 
          });
      }

      // Emit login event for admins
      if (global.io) {
          global.io.emit('user_logged_in', {
              userName: user.name,
              userId: user._id,
              role: user.role,
              timestamp: new Date()
          });
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
        bloodType: user.bloodType,
        isAvailable: user.isAvailable,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    if (req.user) {
      res.json(req.user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Google Sign-In
// @route   POST /api/auth/google-signin
// @access  Public
router.post('/google-signin', async (req, res) => {
  const { email, name, googleId } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user with Google account
      user = await User.create({
        name,
        email,
        googleId,
        role: 'seeker', // Default role for Google sign-in
        password: Math.random().toString(36).slice(-8), // Random password (won't be used)
        isAvailable: true,
        isVerified: true // Google accounts start verified
      });
    } else if (!user.googleId) {
      // Link Google account to existing user
      user.googleId = googleId;
      user.isVerified = true; // Trust Google verification
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      location: user.location,
      bloodType: user.bloodType,
      isAvailable: user.isAvailable,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new admin user
// @route   POST /api/auth/create-admin
// @access  Private/Admin
router.post('/create-admin', protect, admin, async (req, res) => {
  const { name, email, password, phone, location } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'admin',
      phone,
      location,
      isAvailable: false // Admins are not donors by default
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
