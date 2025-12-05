const CryptoJS = require('crypto-js');

// Default key (fallback) and optional key map for future extra keys
const defaultKey = process.env.ENCRYPTION_KEY || 'default_secret_key_for_dev';
const sensitiveKey = process.env.SENSITIVE_KEY || 'sensitive_data_secret_key_123';
const criticalKey = process.env.CRITICAL_KEY || 'critical_financial_key_456';

const keyMap = {
  default: defaultKey,
  sensitive: sensitiveKey,
  critical: criticalKey,
  // Add additional keys here
};

/**
 * Encrypt data using a specific key identifier (default if omitted).
 * @param {any} data - Data to encrypt.
 * @param {string} [keyId='default'] - Identifier of the key to use.
 * @returns {string} Encrypted ciphertext.
 */
const encryptData = (data, keyId = 'default') => {
  if (!data) return data;
  const key = keyMap[keyId] || defaultKey;
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

/**
 * Decrypt data using a specific key identifier (default if omitted).
 * @param {string} ciphertext - Encrypted string.
 * @param {string} [keyId='default'] - Identifier of the key to use.
 * @returns {any} Decrypted object or null on failure.
 */
const decryptData = (ciphertext, keyId = 'default') => {
  if (!ciphertext) return ciphertext;
  try {
    const key = keyMap[keyId] || defaultKey;
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
};

const encryptObjectValues = (obj, keyId = 'default') => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => encryptObjectValues(item, keyId));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = encryptObjectValues(obj[key], keyId);
      }
    }
    return newObj;
  }
  
  // Primitives (string, number, boolean)
  return encryptData(obj, keyId);
};

const decryptObjectValues = (obj, keyId = 'default') => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => decryptObjectValues(item, keyId));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = decryptObjectValues(obj[key], keyId);
      }
    }
    return newObj;
  }
  
  // Assume it's a primitive encrypted string
  // If it's not a string, return as is (maybe it wasn't encrypted)
  if (typeof obj === 'string') {
     // Try to decrypt; if it fails (not encrypted), return original
     // But wait, our decryptData logs error and returns null on failure.
     // Improved logic: if it looks like ciphertext (e.g. starts with U2F), try decrypt.
     // For now, simpler: try decrypt, if null return original? No, decryptData returns null on fail.
     // We need to be careful not to decrypt things that aren't encrypted.
     // But since we are strictly encrypting payload, we assume incoming values ARE encrypted.
     // Actually, if we use X-Encryption-Key-Id, we assume the whole payload (leafs) is encrypted.
     const decrypted = decryptData(obj, keyId);
     // If null, it might mean bad key or bad data. Or just not encrypted.
     // Given the constraint "keep schema same", we replaced values with ciphertexts.
     return decrypted !== null ? decrypted : obj;
  }
  
  return obj;
};

module.exports = { encryptData, decryptData, encryptObjectValues, decryptObjectValues };
