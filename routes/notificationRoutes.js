const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// @desc    Get user notifications
// @route   GET /api/notifications/:userId
// @access  Public (should be private)
router.get('/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Public
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (notification) {
      notification.isRead = true;
      await notification.save();
      res.json(notification);
    } else {
      res.status(404).json({ message: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark all notifications as read for a user
// @route   PUT /api/notifications/user/:userId/read-all
// @access  Public
router.put('/user/:userId/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.params.userId, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get unread notification count
// @route   GET /api/notifications/user/:userId/unread-count
// @access  Public
router.get('/user/:userId/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.params.userId,
      isRead: false,
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update notification status
// @route   PUT /api/notifications/:id/status
// @access  Public
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const notification = await Notification.findById(req.params.id);
    if (notification) {
      notification.status = status;
      await notification.save();
      res.json(notification);
    } else {
      res.status(404).json({ message: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
