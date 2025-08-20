// src/services/auth.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Configurações
const SALT_ROUNDS = 10;
const JWT_EXPIRATION = '7d';

/**
 * Gera hash de senha usando bcrypt
 * @param {string} password - Senha em texto plano
 * @returns {Promise<string>} Hash da senha
 */
async function hashPassword(password) {
    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (error) {
        console.error('Erro ao gerar hash da senha:', error);
        throw new Error('Erro ao processar senha');
    }
}

/**
 * Verifica se a senha corresponde ao hash
 * @param {string} password - Senha em texto plano
 * @param {string} hash - Hash armazenado
 * @returns {Promise<boolean>} True se a senha corresponde
 */
async function verifyPassword(password, hash) {
    try {
        const match = await bcrypt.compare(password, hash);
        return match;
    } catch (error) {
        console.error('Erro ao verificar senha:', error);
        throw new Error('Erro ao verificar senha');
    }
}

/**
 * Gera token JWT para autenticação
 * @param {object} payload - Dados do usuário para incluir no token
 * @returns {string} Token JWT assinado
 */
function generateToken(payload) {
    try {
        // Adiciona timestamp ao payload
        const tokenPayload = {
            ...payload,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias em segundos
        };

        // Verifica se o JWT_SECRET está configurado
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET não configurado');
        }

        // Gera o token
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { 
                algorithm: 'HS256'
            }
        );

        return token;
    } catch (error) {
        console.error('Erro ao gerar token JWT:', error);
        throw new Error('Erro ao gerar token de autenticação');
    }
}

/**
 * Verifica e decodifica token JWT
 * @param {string} token - Token JWT
 * @returns {object} Payload decodificado do token
 */
function verifyToken(token) {
    try {
        // Verifica se o JWT_SECRET está configurado
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET não configurado');
        }

        // Verifica e decodifica o token
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256']
        });

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expirado');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Token inválido');
        } else {
            console.error('Erro ao verificar token:', error);
            throw new Error('Erro na verificação do token');
        }
    }
}

/**
 * Valida formato de email
 * @param {string} email - Email a ser validado
 * @returns {boolean} True se o email é válido
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valida senha (mínimo 6 caracteres)
 * @param {string} password - Senha a ser validada
 * @returns {object} Objeto com válido e mensagem de erro
 */
function validatePassword(password) {
    if (!password || password.length < 6) {
        return {
            valid: false,
            message: 'A senha deve ter no mínimo 6 caracteres'
        };
    }
    return {
        valid: true,
        message: ''
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    validateEmail,
    validatePassword
};
