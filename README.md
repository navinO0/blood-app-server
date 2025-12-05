# Blood Donation App - Backend Server

A Node.js/Express backend server for the Blood Donation application with real-time notifications, email services, and MongoDB database.

## 🚀 Features

- **RESTful API** - Blood request management, user authentication
- **Real-time Notifications** - Socket.io for instant updates
- **Email Service** - Gmail SMTP with customizable templates
- **Database** - MongoDB with Mongoose ODM
- **Security** - JWT authentication, optional data encryption
- **Logging** - Winston logger with cURL format for errors
- **Message Queue** - Kafka integration for event streaming

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally or remote)
- Kafka (optional, for event streaming)
- Gmail account with App Password (for email service)

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Copy the `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```

3. **Set up MongoDB:**
   
   Make sure MongoDB is running:
   ```bash
   # Using Docker
   docker-compose up -d mongodb
   
   # Or start local MongoDB
   mongod
   ```

4. **Generate VAPID keys for push notifications:**
   ```bash
   node generate_keys.js
   ```

## ⚙️ Environment Variables

### Required

```bash
# Database
MONGO_URI=mongodb://root:example@127.0.0.1:27017/mydb?authSource=admin

# Server
PORT=5000
JWT_SECRET=your_jwt_secret_key_here

# Frontend URL (for CORS and email links)
FRONTEND_URL=http://localhost:3000
```

### Email Configuration

```bash
# Gmail SMTP (requires App Password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password

# Email sender info
EMAIL_FROM_NAME=BloodLink
EMAIL_FROM_ADDRESS=your-email@gmail.com
```

**📧 Gmail App Password Setup:**
1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Copy the 16-character password (remove spaces)
4. Add to `EMAIL_PASS` in `.env`

### Optional

```bash
# Encryption
ENCRYPTION_KEY=my_super_secret_key_12345
ENABLE_ENCRYPTION=false

# Kafka
KAFKA_BROKERS=127.0.0.1:9092

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_MAILTO=mailto:admin@yourapp.com
```

## 🏃 Running the Server

### Development Mode
```bash
npm run dev
```
Server runs on http://localhost:5000 with auto-reload via nodemon.

### Production Mode
```bash
npm start
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/google-signin` - Google OAuth sign-in
- `PUT /api/auth/profile` - Update user profile

### Blood Requests
- `POST /api/blood/request` - Create blood request
- `POST /api/blood/accept` - Accept blood request
- `GET /api/blood/donors` - Get available donors
- `GET /api/blood/requests/:id/donors` - Get donors who accepted a request

### Notifications
- `GET /api/notifications/:userId` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/user/:userId/read-all` - Mark all as read
- `GET /api/notifications/user/:userId/unread-count` - Get unread count
- `PUT /api/notifications/:id/status` - Update notification status

### Push Notifications
- `POST /api/push/subscribe` - Subscribe to push notifications
- `POST /api/push/send` - Send push notification

## 🧪 Testing

### Test Email Service
```bash
curl -X POST "http://localhost:5000/api/blood/request" \
  -H "Content-Type: application/json" \
  -d '{"seekerId":"USER_ID","bloodType":"A+","location":"Mumbai"}'
```

Check server console for email preview URL or check recipient's inbox.

### Test Notifications
```bash
# Get notifications
curl http://localhost:5000/api/notifications/USER_ID

# Mark as read
curl -X PUT http://localhost:5000/api/notifications/NOTIFICATION_ID/read
```

## 📁 Project Structure

```
server/
├── config/
│   └── db.js                 # MongoDB connection
├── middleware/
│   ├── encryptionMiddleware.js
│   └── loggerMiddleware.js   # Request/error logging
├── models/
│   ├── User.js
│   ├── BloodRequest.js
│   └── Notification.js
├── routes/
│   ├── authRoutes.js
│   ├── bloodRoutes.js
│   ├── notificationRoutes.js
│   └── pushRoutes.js
├── services/
│   └── kafka.js              # Kafka event streaming
├── utils/
│   ├── crypto.js             # Encryption utilities
│   ├── email.js              # Email service
│   └── logger.js             # Winston logger
├── logs/                     # Log files
├── .env                      # Environment variables
├── server.js                 # Main server file
└── package.json
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt for password security
- **Optional Encryption** - AES-256 encryption for sensitive data
- **CORS Protection** - Configurable CORS origins
- **Input Validation** - Request validation and sanitization

## 📊 Logging

The server uses Winston for logging with the following features:

- **Console Logging** - Colored output for development
- **File Logging** - Separate files for errors and combined logs
- **cURL Format** - Error responses logged with full cURL command for easy reproduction

**Log Files:**
- `logs/error.log` - Error-level logs only
- `logs/combined.log` - All logs

## 🔄 Real-time Features

### Socket.io Events

**Server Emits:**
- `blood-request-notification` - New blood request to donors
- `donation-accepted-notification` - Acceptance notification to seeker

**Client Listens:**
- Connect to `http://localhost:5000` (or `FRONTEND_URL`)

## 🐛 Troubleshooting

### MongoDB Connection Error
```bash
# Check if MongoDB is running
docker ps
# Or
sudo systemctl status mongod
```

### Email Not Sending
- Verify `EMAIL_USER` and `EMAIL_PASS` are correct
- Ensure you're using Gmail App Password, not regular password
- Check server logs for detailed error messages

### Kafka Connection Error
- Kafka is optional - server will work without it
- To disable Kafka, comment out Kafka-related code in `server.js`

### Port Already in Use
```bash
# Find process using port 5000
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Mac/Linux

# Kill the process or change PORT in .env
```

## 📝 License

MIT

## 👥 Support

For issues or questions, please check the logs in `logs/` directory or contact the development team.
