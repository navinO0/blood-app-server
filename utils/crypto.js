const CryptoJS = require('crypto-js');

// Default key (fallback) and optional key map for future extra keys
const defaultKey = process.env.ENCRYPTION_KEY || 'default_secret_key_for_dev';
const keyMap = {
  default: defaultKey,
  // Add additional keys here, e.g., extra1: process.env.EXTRA_KEY_1
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

module.exports = { encryptData, decryptData };
