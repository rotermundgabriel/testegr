// src/utils/crypto.js
const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

/**
 * Criptografa o access token do Mercado Pago
 * @param {string} accessToken - Token em texto plano
 * @returns {string} Token criptografado com IV
 */
function encryptAccessToken(accessToken) {
    try {
        // Verifica se a chave de criptografia está configurada
        if (!process.env.ENCRYPTION_KEY) {
            throw new Error('ENCRYPTION_KEY não configurada no .env');
        }

        const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(accessToken, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Retorna IV + token criptografado separados por ':'
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Erro ao criptografar access token:', error);
        throw new Error('Falha na criptografia do token');
    }
}

/**
 * Descriptografa o access token do Mercado Pago
 * @param {string} encryptedData - Token criptografado com IV
 * @returns {string} Token em texto plano
 */
function decryptAccessToken(encryptedData) {
    try {
        // Verifica se a chave de criptografia está configurada
        if (!process.env.ENCRYPTION_KEY) {
            throw new Error('ENCRYPTION_KEY não configurada no .env');
        }

        if (!encryptedData || !encryptedData.includes(':')) {
            throw new Error('Formato de token criptografado inválido');
        }

        const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        
        // Separar IV do token criptografado
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedToken = parts[1];
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Erro ao descriptografar access token:', error);
        throw new Error('Falha na descriptografia do token');
    }
}

/**
 * Valida o formato do access token do Mercado Pago
 * @param {string} token - Access token
 * @returns {boolean} True se o formato é válido
 */
function validateMPAccessToken(token) {
    if (!token) return false;
    
    // Tokens de produção começam com APP_USR-
    // Tokens de teste começam com TEST-
    return token.startsWith('APP_USR-') || token.startsWith('TEST-');
}

/**
 * Valida o formato da public key do Mercado Pago
 * @param {string} publicKey - Public key
 * @returns {boolean} True se o formato é válido
 */
function validateMPPublicKey(publicKey) {
    if (!publicKey) return false;
    
    // Public keys geralmente têm pelo menos 10 caracteres
    // Formato: APP_USR-xxxxx ou TEST-xxxxx
    return publicKey.length >= 10;
}

/**
 * Gera uma chave de criptografia segura (usar apenas uma vez para setup)
 * @returns {string} Chave hexadecimal de 32 bytes
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encryptAccessToken,
    decryptAccessToken,
    validateMPAccessToken,
    validateMPPublicKey,
    generateEncryptionKey
};
