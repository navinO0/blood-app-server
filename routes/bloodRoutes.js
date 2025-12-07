const express = require('express');
const router = express.Router();
const User = require('../models/User');
const BloodRequest = require('../models/BloodRequest');
const { sendEvent } = require('../services/kafka');
const Notification = require('../models/Notification');

const sendEmail = require('../utils/email');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

/**
 * @swagger
 * /api/blood/request:
 *   post:
 *     summary: Create a new blood request
 *     description: Creates a blood request and notifies matching donors via email and in-app notifications
 *     tags: [Blood Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seekerId
 *               - bloodType
 *               - location
 *             properties:
 *               seekerId:
 *                 type: string
 *                 description: ID of the user requesting blood
 *                 example: "507f1f77bcf86cd799439011"
 *               bloodType:
 *                 type: string
 *                 enum: [A+, A-, B+, B-, AB+, AB-, O+, O-]
 *                 description: Required blood type
 *                 example: "A+"
 *               location:
 *                 type: string
 *                 description: Location where blood is needed
 *                 example: "Mumbai"
 *     responses:
 *       201:
 *         description: Blood request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BloodRequest'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/request', protect, admin, async (req, res) => {
  const { seekerId, bloodType, location, locationUrl, patientName, quantity, sendEmailNotifications } = req.body;

  if (!seekerId || !bloodType || !location) {
    return res.status(400).json({ message: 'seekerId, bloodType and location are required' });
  }

  try {
    const request = await BloodRequest.create({
      seekerId,
      bloodType,
      location,
      locationUrl,
      patientName,
      quantity,
      acceptedBy: []
    });

    const eventPayload = {
      requestId: request._id,
      seekerId,
      bloodType,
      location,
      timestamp: new Date(),
    };

    // Emit event for other services (analytics, notifications pipeline, etc.)
    await sendEvent('blood-requests', eventPayload);

    // Find matching donors (exclude seeker)
    const donors = await User.find({
      bloodType,
      isAvailable: true,
      _id: { $ne: seekerId }
    });

    // Notify donors (email + create Notification record)
    // Use for...of so we can await and handle errors properly
    for (const donor of donors) {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const acceptLink = `${frontendUrl}/respond?requestId=${request._id}&donorId=${donor._id}`;

        // Always create an in-app notification for donor
        await Notification.create({
          recipientId: donor._id,
          message: `New blood request for ${bloodType} near ${location}. Tap to view or accept.`,
          type: 'blood_request',
          relatedRequestId: request._id,
        });

        // Only send email if both seeker wants to send AND donor wants to receive
        if (sendEmailNotifications !== false && donor.emailNotifications) {
          // Send email using template system
          await sendEmail({
            to: donor.email,
            template: 'blood_request',
            templateVars: {
              donorName: donor.name || 'Donor',
              bloodType: bloodType,
              location: location,
              acceptLink: acceptLink,
            }
          });
        }

        // Optionally: send push notification / SMS here via queue/service
        // e.g., enqueueJob('send-push', { userId: donor._id, requestId: request._id, ... })
      } catch (innerErr) {
        // Log and continue with other donors
        console.error(`Failed to notify donor ${donor._id}:`, innerErr);
        // Optionally: mark donor as unreachable or remove stale subscription if error indicates that
      }
    }

    // Return created request to the caller
    return res.status(201).json(request);
  } catch (error) {
    console.error('POST /api/blood/request error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @desc    Accept blood request (with optional new donor registration)
// @route   POST /api/blood/accept
// @access  Public
router.post('/accept', async (req, res) => {
  const { requestId, donorId, donorName, donorData } = req.body;

  // If donorData is provided, this is a new donor registration
  if (donorData) {
    const { name, email, phone, bloodType, location, emailNotifications } = donorData;

    if (!requestId || !name || !email || !bloodType || !location) {
      return res.status(400).json({ 
        message: 'requestId, name, email, bloodType, and location are required for new donor registration' 
      });
    }

    try {
      // Check if user already exists
      let donor = await User.findOne({ email: email.toLowerCase() });

      if (donor) {
        // User exists, just accept the request with their existing ID
        const request = await BloodRequest.findById(requestId);
        if (!request) {
          return res.status(404).json({ message: 'Request not found' });
        }

        if (!Array.isArray(request.acceptedBy)) request.acceptedBy = [];

        if (!request.acceptedBy.includes(donor._id)) {
          request.acceptedBy.push(donor._id);
          await request.save();

          // Create Notification for Seeker
          await Notification.create({
            recipientId: request.seekerId,
            message: `${donor.name} has accepted your blood request for ${request.bloodType}.`,
            type: 'request_accepted',
            relatedRequestId: requestId,
          });

          const eventPayload = {
            requestId,
            donorId: donor._id,
            donorName: donor.name,
            seekerId: request.seekerId,
            timestamp: new Date(),
          };

          await sendEvent('donation-offers', eventPayload);
        }

        return res.json({ request, donor: { _id: donor._id, name: donor.name, email: donor.email } });
      }

      // Create new donor account
      const newDonor = await User.create({
        name,
        email: email.toLowerCase(),
        password: Math.random().toString(36).slice(-8) + 'Aa1!', // Generate random password
        role: 'donor',
        bloodType,
        location,
        phone: phone || '',
        isAvailable: true,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
      });

      // Accept the request with new donor
      const request = await BloodRequest.findById(requestId);
      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      if (!Array.isArray(request.acceptedBy)) request.acceptedBy = [];

      request.acceptedBy.push(newDonor._id);
      await request.save();

      // Create Notification for Seeker
      await Notification.create({
        recipientId: request.seekerId,
        message: `${newDonor.name} has accepted your blood request for ${request.bloodType}.`,
        type: 'request_accepted',
        relatedRequestId: requestId,
      });

      const eventPayload = {
        requestId,
        donorId: newDonor._id,
        donorName: newDonor.name,
        seekerId: request.seekerId,
        timestamp: new Date(),
      };

      await sendEvent('donation-offers', eventPayload);

      return res.json({ 
        request, 
        donor: { _id: newDonor._id, name: newDonor.name, email: newDonor.email },
        newDonorCreated: true 
      });

    } catch (error) {
      console.error('POST /api/blood/accept (new donor) error:', error);
      return res.status(500).json({ message: error.message || 'Server error' });
    }
  }

  // Original flow for existing donors
  if (!requestId || !donorId) {
    return res.status(400).json({ message: 'requestId and donorId are required' });
  }

  try {
    const request = await BloodRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Ensure acceptedBy exists and is an array
    if (!Array.isArray(request.acceptedBy)) request.acceptedBy = [];

    if (!request.acceptedBy.includes(donorId)) {
      request.acceptedBy.push(donorId);
      await request.save();

      // Create Notification for Seeker
      await Notification.create({
        recipientId: request.seekerId,
        message: `${donorName || 'A donor'} has accepted your blood request for ${request.bloodType}.`,
        type: 'request_accepted',
        relatedRequestId: requestId,
      });

      // Update the donor's notification status to 'accepted'
      await Notification.updateOne(
        { 
          recipientId: donorId, 
          relatedRequestId: requestId, 
          type: 'blood_request' 
        },
        { status: 'accepted', isRead: true }
      );

      // Mark other pending notifications for this request as 'expired' (optional)
      await Notification.updateMany(
        {
          relatedRequestId: requestId,
          type: 'blood_request',
          status: 'pending',
          recipientId: { $ne: donorId }
        },
        { status: 'expired' }
      );

      const eventPayload = {
        requestId,
        donorId,
        donorName,
        seekerId: request.seekerId,
        timestamp: new Date(),
      };

      // Notify other services
      await sendEvent('donation-offers', eventPayload);
    }

    return res.json(request);
  } catch (error) {
    console.error('POST /api/blood/accept error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @desc    Get all donors (available users)
// @route   GET /api/blood/donors
// @access  Private/Admin
router.get('/donors', protect, admin, async (req, res) => {
  const { bloodType, location } = req.query;
  const query = { isAvailable: true };

  // Cooling period check (90 days)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  query.$or = [
    { lastDonatedDate: null },
    { lastDonatedDate: { $lt: threeMonthsAgo } }
  ];

  if (bloodType) {
    query.bloodType = bloodType;
  }

  if (location) {
    // Case-insensitive search already handled by regex with 'i' flag
    query.location = { $regex: location, $options: 'i' };
  }

  try {
    const donors = await User.find(query).select('-password');
    return res.json(donors);
  } catch (error) {
    console.error('GET /api/blood/donors error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @desc    Get single blood request by ID (for shareable links)
// @route   GET /api/blood/requests/:id
// @access  Public
router.get('/requests/:id', async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
      .populate('seekerId', 'name phone location')
      .populate('acceptedBy', 'name email phone location bloodType');
    
    if (!request) {
      return res.status(404).json({ message: 'Blood request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('GET /api/blood/requests/:id error:', error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get donors who accepted a specific request

// @route   GET /api/blood/requests/:id/donors
// @access  Private
router.get('/requests/:id/donors', async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id).populate('acceptedBy', 'name email phone location bloodType');
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    return res.json(request.acceptedBy);
  } catch (error) {
    console.error('GET /api/blood/requests/:id/donors error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @desc    Confirm donation (Admin only)
// @route   POST /api/blood/confirm-donation
// @access  Private/Admin
router.post('/confirm-donation', protect, admin, async (req, res) => {
  const { donorId, requestId } = req.body;

  if (!donorId) {
    return res.status(400).json({ message: 'donorId is required' });
  }

  try {
    const donor = await User.findById(donorId);
    if (!donor) {
      return res.status(404).json({ message: 'Donor not found' });
    }

    // Update donor status
    donor.lastDonatedDate = new Date();
    donor.isAvailable = false; // Mark as unavailable immediately after donation
    await donor.save();

    // Optionally update request status to 'fulfilled' if needed
    if (requestId) {
      const request = await BloodRequest.findById(requestId);
      if (request) {
        request.status = 'fulfilled';
        await request.save();
      }
    }

    res.json({ message: 'Donation confirmed successfully', donor });
  } catch (error) {
    console.error('POST /api/blood/confirm-donation error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;

// @desc    Get all requests (Admin only)
// @route   GET /api/blood/admin/requests
// @access  Private/Admin
router.get('/admin/requests', protect, admin, async (req, res) => {
  try {
    const requests = await BloodRequest.find({})
      .populate('seekerId', 'name phone location')
      .populate('acceptedBy', 'name email phone location bloodType lastDonatedDate')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('GET /api/blood/admin/requests error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});
