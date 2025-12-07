const crypto = require("crypto");

// Configuration from Environment
const getEncryptionKey = () => {
    const keyHex = process.env.ENCRYPTION_KEY_HEX;
    if (!keyHex) {
        throw new Error("ENCRYPTION_KEY_HEX is missing in environment variables");
    }
    return Buffer.from(keyHex, "hex");
};

function encryptData(text) {
    if (text === null || text === undefined) return text;
    try {
        const aesSecKey = getEncryptionKey();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", aesSecKey, iv);

        let encrypted = cipher.update(text, "utf8");
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Combine ciphertext and authTag
        const combined = Buffer.concat([encrypted, authTag]);

        return iv.toString("base64") + ":" + combined.toString("base64");
    } catch (error) {
        console.error("Encryption failed:", error.message);
        throw error;
    }
}

function decryptData(encryptedString) {
    if (encryptedString === null || encryptedString === undefined) return encryptedString;
    try {
        const aesSecKey = getEncryptionKey();
        
        if (typeof encryptedString !== 'string') return encryptedString;
        
        const [ivBase64, encryptedBase64] = encryptedString.split(":");

        if (!ivBase64 || !encryptedBase64) {
             // Return original if it doesn't look like our encrypted format
            return encryptedString;
        }

        const iv = Buffer.from(ivBase64, "base64");
        const encryptedBuffer = Buffer.from(encryptedBase64, "base64");

        if (iv.length !== 12) {
             // Return original if IV is invalid (fallback)
            return encryptedString;
        }

        const decipher = crypto.createDecipheriv("aes-256-gcm", aesSecKey, iv);

        // Extract authentication tag from the end of encrypted data
        const authTag = encryptedBuffer.slice(-16);
        const ciphertext = encryptedBuffer.slice(0, -16);

        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext);
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error.message);
        // Fallback: return original string if decryption fails (e.g. data wasn't encrypted)
        return encryptedString; 
    }
}

// Encrypt specific fields in the object
function encryptObject(obj, enc_keys) {
    if (!obj || typeof obj !== 'object') return obj;

    // Handle Mongoose documents and deep objects by ensuring plain JSON structure
    // This converts ObjectId and ISO Dates to strings, preventing "exploded" objects
    if (typeof obj.toJSON === 'function' || (obj.constructor && obj.constructor.name === 'model')) {
        obj = JSON.parse(JSON.stringify(obj));
    }

    if (Array.isArray(obj)) {
        return obj.map(item => encryptObject(item, enc_keys));
    }

    const newObj = { ...obj }; // shallow copy to avoid mutating original if passed by ref

    for (let key in newObj) {
        if (!newObj.hasOwnProperty(key)) continue;

        if (enc_keys.includes(key) && typeof newObj[key] === "string") {
            newObj[key] = encryptData(newObj[key]);
        }
        else if (newObj[key] && typeof newObj[key] === "object") {
            newObj[key] = encryptObject(newObj[key], enc_keys);
        }
    }
    return newObj;
}

// Decrypt specific fields in object
function decryptObject(obj, dec_keys) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => decryptObject(item, dec_keys));
    }

    const newObj = { ...obj };

    for (let key in newObj) {
        if (!newObj.hasOwnProperty(key)) continue;

        if (dec_keys.includes(key) && typeof newObj[key] === "string") {
            newObj[key] = decryptData(newObj[key]);
        }
        else if (newObj[key] && typeof newObj[key] === "object") {
            newObj[key] = decryptObject(newObj[key], dec_keys);
        }
    }
    return newObj;
}

module.exports = { encryptObject, decryptObject, encryptData, decryptData };
