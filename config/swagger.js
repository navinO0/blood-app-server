const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blood Donation App API',
      version: '1.0.0',
      description: 'RESTful API for Blood Donation application with real-time notifications and email services',
      contact: {
        name: 'API Support',
        email: 'support@bloodapp.com',
      },
    },
    servers: [
      {
        url: process.env.FRONTEND_URL || 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            phone: { type: 'string', example: '+1234567890' },
            location: { type: 'string', example: 'Mumbai' },
            bloodType: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], example: 'A+' },
            role: { type: 'string', enum: ['donor', 'seeker'], example: 'donor' },
            isAvailable: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        BloodRequest: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            seekerId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            bloodType: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], example: 'A+' },
            location: { type: 'string', example: 'Mumbai' },
            status: { type: 'string', enum: ['pending', 'fulfilled'], example: 'pending' },
            acceptedBy: { type: 'array', items: { type: 'string' }, example: [] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            recipientId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            message: { type: 'string', example: 'New blood request for A+ near Mumbai' },
            type: { type: 'string', enum: ['request_accepted', 'blood_request', 'other'], example: 'blood_request' },
            relatedRequestId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            isRead: { type: 'boolean', example: false },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'expired'], example: 'pending' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Error message' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './docs/*.js'], // Path to the API routes and documentation
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
