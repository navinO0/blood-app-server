const { encryptData, decryptData } = require('../utils/crypto');
const logger = require('../utils/logger');

// Toggle via env (default true for backward compatibility)
const enableEncryption = process.env.ENABLE_ENCRYPTION === 'true';

const encryptionMiddleware = (req, res, next) => {
  if (!enableEncryption) return next();

  // Decrypt Request Body (supports keyId)
  if (req.body && req.body.data) {
    const keyId = req.body.keyId || 'default';
    const decrypted = decryptData(req.body.data, keyId);
    if (decrypted) {
      req.body = decrypted;
    } else {
      return res.status(400).json({ message: 'Invalid encrypted data' });
    }
  }

  // Intercept Response to Encrypt (adds keyId header if needed)
  const originalJson = res.json;
  res.json = function (body) {
    if (!enableEncryption) return originalJson.call(this, body);
    // Only encrypt if not already encrypted
    if (body && !body.data) {
      const keyId = res.getHeader('X-Encrypt-Key') || 'default';
      const encrypted = encryptData(body, keyId);
      return originalJson.call(this, { data: encrypted, keyId });
    }
    return originalJson.call(this, body);
  };

  next();
};

module.exports = encryptionMiddleware;
