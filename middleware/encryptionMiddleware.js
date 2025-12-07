const { encryptObject, decryptObject } = require('../utils/encryption');

// Toggle via env
const enableEncryption = process.env.ENABLE_ENCRYPTION === 'true';
// const enableEncryption = true; // FORCE TRUE FOR DEBUGGING

const encryptionMiddleware = (req, res, next) => {
  // Get fields to encrypt/decrypt from ENV
  let encryptedFields = [];
  try {
      encryptedFields = JSON.parse(process.env.ENCRYPTED_FIELDS || '[]');
  } catch (e) {
      console.error("[ERROR] Failed to parse ENCRYPTED_FIELDS", e);
  }

  // Check Key availability
  if (!process.env.ENCRYPTION_KEY_HEX) {
      console.error("[ERROR] ENCRYPTION_KEY_HEX is missing!");
  }

  // Decrypt Request Body
  if (req.body && Object.keys(req.body).length > 0) {
    try {
        req.body = decryptObject(req.body, encryptedFields);
    } catch (err) {
        console.error("Decrypt Request Body Failed:", err);
    }
  }

  // Intercept Response to Encrypt
  const originalJson = res.json;
  res.json = function (body) {
    if (!enableEncryption) return originalJson.call(this, body);
    
    // Only encrypt if it's an object/array and not empty
    if (body) {
      try {
          const encryptedBody = encryptObject(body, encryptedFields);
          return originalJson.call(this, encryptedBody);
      } catch (err) {
          console.error("[CRITICAL] Response Encryption Failed - Returning Original:", err);
          return originalJson.call(this, body); // Fallback to original
      }
    }
    return originalJson.call(this, body);
  };

  next();
};

module.exports = encryptionMiddleware;
