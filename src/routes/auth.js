// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const {
    hashPassword,
    verifyPassword,
    generateToken,
    validateEmail,
    validatePassword
} = require('../services/auth');
const {
    encryptAccessToken,
    decryptAccessToken,
    validateMPAccessToken,
    validateMPPublicKey
} = require('../utils/crypto');

// Inicializa conexão com o banco
const db = new Database(path.join(process.cwd(), 'database.db'));

// Primeiro, vamos alterar a tabela users para incluir os campos necessários
// Este código roda apenas uma vez para adicionar as colunas se não existirem
try {
    // Verifica se as colunas já existem
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columns = tableInfo.map(col => col.name);
    
    if (!columns.includes('email')) {
        db.prepare('ALTER TABLE users ADD COLUMN email TEXT UNIQUE').run();
    }
    if (!columns.includes('password')) {
        db.prepare('ALTER TABLE users ADD COLUMN password TEXT').run();
    }
    if (!columns.includes('name')) {
        db.prepare('ALTER TABLE users ADD COLUMN name TEXT').run();
    }
    
    console.log('Tabela users atualizada com sucesso');
} catch (error) {
    console.log('Colunas já existem ou erro ao atualizar tabela:', error.message);
}

/**
 * POST /api/auth/register
 * Registra um novo usuário com credenciais do Mercado Pago
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, access_token, public_key } = req.body;

        // Log para debug
        console.log('Tentativa de registro:', { email, name, has_mp_credentials: !!(access_token && public_key) });

        // Validação dos campos obrigatórios
        if (!email || !password || !name || !access_token || !public_key) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios',
                error: 'Todos os campos são obrigatórios'
            });
        }

        // Valida formato do email
        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido',
                error: 'Email inválido'
            });
        }

        // Valida senha
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.message,
                error: passwordValidation.message
            });
        }

        // Valida formato do access_token do Mercado Pago
        if (!validateMPAccessToken(access_token)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Mercado Pago access token format',
                error: 'Invalid Mercado Pago access token format'
            });
        }

        // Valida formato da public_key do Mercado Pago
        if (!validateMPPublicKey(public_key)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Mercado Pago public key',
                error: 'Invalid Mercado Pago public key'
            });
        }

        // Verifica se o email já está cadastrado
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        
        if (existingUser) {
            console.log('Email já cadastrado:', email);
            return res.status(400).json({
                success: false,
                message: 'Email already exists',
                error: 'Email already exists'
            });
        }

        // Gera hash da senha
        const hashedPassword = await hashPassword(password);

        // Criptografa o access_token antes de salvar
        let encryptedToken;
        try {
            encryptedToken = encryptAccessToken(access_token);
        } catch (cryptoError) {
            console.error('Erro ao criptografar token:', cryptoError);
            return res.status(500).json({
                success: false,
                message: 'Erro ao processar credenciais do Mercado Pago',
                error: 'Erro ao processar credenciais do Mercado Pago'
            });
        }

        // Cria o novo usuário com credenciais do MP
        const userId = uuidv4();
        const stmt = db.prepare(`
            INSERT INTO users (id, email, password, name, store_name, access_token, public_key, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        stmt.run(
            userId,
            email.toLowerCase(),
            hashedPassword,
            name,
            name, // Usar o nome como store_name inicial
            encryptedToken, // Access token criptografado
            public_key,     // Public key em texto (não é sensível)
        );

        // Gera token JWT
        const token = generateToken({
            userId,
            email: email.toLowerCase(),
            name
        });

        console.log('Usuário registrado com sucesso:', userId);
        console.log('Credenciais do Mercado Pago configuradas');

        // Retorna sucesso
        res.status(201).json({
            success: true,
            token,
            user: {
                id: userId,
                email: email.toLowerCase(),
                name,
                has_mp_credentials: true
            }
        });

    } catch (error) {
        console.error('Erro no registro:', error);
        
        // Verifica se é erro de constraint único (email duplicado)
        if (error.message && error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists',
                error: 'Email already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro ao criar usuário',
            error: process.env.NODE_ENV === 'production' 
                ? 'Erro ao criar usuário' 
                : error.message
        });
    }
});

/**
 * POST /api/auth/login
 * Autentica um usuário existente
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Log para debug
        console.log('Tentativa de login:', { email });

        // Validação dos campos obrigatórios
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email e senha são obrigatórios'
            });
        }

        // Busca o usuário pelo email
        const user = db.prepare(`
            SELECT id, email, password, name 
            FROM users 
            WHERE email = ?
        `).get(email.toLowerCase());

        if (!user) {
            console.log('Usuário não encontrado:', email);
            return res.status(401).json({
                success: false,
                error: 'Email ou senha incorretos'
            });
        }

        // Verifica a senha
        const passwordMatch = await verifyPassword(password, user.password);

        if (!passwordMatch) {
            console.log('Senha incorreta para:', email);
            return res.status(401).json({
                success: false,
                error: 'Email ou senha incorretos'
            });
        }

        // Gera token JWT
        const token = generateToken({
            userId: user.id,
            email: user.email,
            name: user.name
        });

        console.log('Login bem-sucedido:', user.id);

        // Retorna sucesso
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production' 
                ? 'Erro ao fazer login' 
                : error.message
        });
    }
});

/**
 * GET /api/auth/me
 * Retorna informações do usuário autenticado (opcional, útil para verificar token)
 */
router.get('/me', (req, res) => {
    // Este endpoint requer o middleware de autenticação
    // Será útil quando o middleware estiver aplicado
    res.json({
        success: false,
        error: 'Endpoint requer autenticação'
    });
});

/**
 * GET /api/auth/mp-credentials/:userId
 * Retorna as credenciais do Mercado Pago descriptografadas (PROTEGIDO)
 * Nota: Este endpoint deve ser usado apenas internamente pelo backend
 */
router.get('/mp-credentials/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // TODO: Adicionar middleware de autenticação aqui
        // Verificar se o userId do token JWT corresponde ao userId solicitado
        
        const user = db.prepare(`
            SELECT access_token, public_key 
            FROM users 
            WHERE id = ?
        `).get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
        // Descriptografa o access_token
        let decryptedToken;
        try {
            decryptedToken = decryptAccessToken(user.access_token);
        } catch (error) {
            console.error('Erro ao descriptografar token:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao recuperar credenciais'
            });
        }
        
        res.json({
            success: true,
            credentials: {
                access_token: decryptedToken,
                public_key: user.public_key
            }
        });
        
    } catch (error) {
        console.error('Erro ao buscar credenciais MP:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar credenciais'
        });
    }
});

module.exports = router;
