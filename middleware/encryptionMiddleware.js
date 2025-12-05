const { encryptData, decryptData, encryptObjectValues, decryptObjectValues } = require('../utils/crypto');
const logger = require('../utils/logger');

// Toggle via env (default true for backward compatibility)
const enableEncryption = process.env.ENABLE_ENCRYPTION === 'true';

const encryptionMiddleware = (req, res, next) => {
  if (!enableEncryption) return next();

  // Decrypt Request Body (supports header or keyId in body)
  // strict "schema same" mode: entire body values might be encrypted
  if (req.body && Object.keys(req.body).length > 0) {
    const keyId = req.get('X-Encryption-Key-Id') || req.body.keyId || 'default';
    
    // Decrypt all values in the body recursively
    const decryptedBody = decryptObjectValues(req.body, keyId);
    
    // If we managed to decrypt something, update the body. 
    // Since decryptObjectValues returns the original if decryption fails, this is safe.
    req.body = decryptedBody;
  }

  // Intercept Response to Encrypt (adds keyId header)
  const originalJson = res.json;
  res.json = function (body) {
    if (!enableEncryption) return originalJson.call(this, body);
    
    // Only encrypt if it's an object/array and not empty
    if (body) {
      const keyId = res.getHeader('X-Encrypt-Key') || 'default';
      
      // Encrypt all values recursively
      const encryptedBody = encryptObjectValues(body, keyId);
      
      // Set the header so client knows which key to use
      res.setHeader('X-Encryption-Key-Id', keyId);
      
      // Return the body with encrypted values (same schema)
      return originalJson.call(this, encryptedBody);
    }
    return originalJson.call(this, body);
  };

  next();
};

module.exports = encryptionMiddleware;
