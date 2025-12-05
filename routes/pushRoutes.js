const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const User = require('../models/User');

// Configure web-push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_MAILTO || 'mailto:test@test.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
}

// @desc    Subscribe to push notifications
// @route   POST /api/push/subscribe
// @access  Private
router.post('/subscribe', async (req, res) => {
  const { userId, subscription } = req.body;

  if (!userId || !subscription) {
      return res.status(400).json({ message: 'Missing userId or subscription' });
  }

  try {
    const user = await User.findById(userId);
    if (user) {
      user.pushSubscription = subscription;
      await user.save();
      res.status(201).json({ message: 'Subscription saved' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Send push notification (Internal/Test)
// @route   POST /api/push/send
// @access  Private (Should be protected)
router.post('/send', async (req, res) => {
    const { userId, title, body, url } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user || !user.pushSubscription) {
            return res.status(404).json({ message: 'User or subscription not found' });
        }

        const payload = JSON.stringify({ title, body, url });
        await webpush.sendNotification(user.pushSubscription, payload);
        res.json({ message: 'Notification sent' });
    } catch (error) {
        console.error('Error sending push:', error);
        res.status(500).json({ message: 'Failed to send notification' });
    }
});

module.exports = router;
