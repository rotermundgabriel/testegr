// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Verifica e inicializa o banco de dados se necessário
const dbPath = path.join(process.cwd(), 'database.db');
if (!fs.existsSync(dbPath)) {
    console.log('🔄 Banco de dados não encontrado. Inicializando...');
    require('./services/database');
}

// Importa rotas
const authRoutes = require('./routes/auth');
// const setupRoutes = require('./routes/setup'); // Descomente quando existir
// const linksRoutes = require('./routes/links'); // Descomente quando existir
// const paymentRoutes = require('./routes/payment'); // Descomente quando existir

// Importa middleware de autenticação
const { authMiddleware } = require('./middleware/auth');

// Inicializa o app
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Log de requisições (útil para debug)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// =====================================
// ROTAS PÚBLICAS (sem autenticação)
// =====================================

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rotas de autenticação (register e login são públicas)
app.use('/api/auth', authRoutes);

// =====================================
// ROTAS PROTEGIDAS (requerem autenticação)
// =====================================

// Rota de teste protegida
app.get('/api/protected', authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: 'Você acessou uma rota protegida!',
        user: {
            id: req.userId,
            email: req.userEmail,
            name: req.userName
        }
    });
});

// Exemplo de rota protegida para obter perfil do usuário
app.get('/api/user/profile', authMiddleware, (req, res) => {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(process.cwd(), 'database.db'));
    
    try {
        const user = db.prepare(`
            SELECT id, email, name, store_name, created_at,
                   CASE WHEN access_token != '' THEN true ELSE false END as mp_configured
            FROM users 
            WHERE id = ?
        `).get(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                storeName: user.store_name,
                mpConfigured: user.mp_configured === 1,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar perfil do usuário'
        });
    }
});

// Futuras rotas protegidas (descomente quando os arquivos existirem)
// app.use('/api/setup', authMiddleware, setupRoutes);
// app.use('/api/links', authMiddleware, linksRoutes);
// app.use('/api/payment', paymentRoutes); // Payment é parcialmente público

// =====================================
// TRATAMENTO DE ERROS
// =====================================

// Rota não encontrada (404)
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado'
    });
});

// Serve o index.html para rotas do frontend (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'vendor', 'index.html'));
});

// Error handler global
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Erro interno do servidor' 
            : err.message
    });
});

// =====================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================

// Verifica configurações essenciais
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  AVISO: JWT_SECRET não está configurado no arquivo .env');
    console.warn('⚠️  Usando secret padrão (INSEGURO para produção)');
    process.env.JWT_SECRET = 'desenvolvimento-inseguro-mudar-em-producao';
}

if (!process.env.ENCRYPTION_KEY) {
    console.warn('⚠️  AVISO: ENCRYPTION_KEY não está configurada no arquivo .env');
    console.warn('⚠️  Usando chave padrão (INSEGURO para produção)');
    console.warn('⚠️  Gere uma chave segura com: openssl rand -hex 32');
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

// Inicia o servidor
app.listen(PORT, () => {
    console.log('=====================================');
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔑 JWT configurado: ${process.env.JWT_SECRET ? 'Sim' : 'Não'}`);
    console.log(`🔐 Criptografia configurada: ${process.env.ENCRYPTION_KEY ? 'Sim' : 'Não'}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('=====================================');
    console.log('Endpoints disponíveis:');
    console.log('  POST /api/auth/register - Registrar novo usuário com credenciais MP');
    console.log('  POST /api/auth/login - Fazer login');
    console.log('  GET  /api/protected - Rota de teste (requer token)');
    console.log('  GET  /api/user/profile - Perfil do usuário (requer token)');
    console.log('=====================================');
});

module.exports = app;
