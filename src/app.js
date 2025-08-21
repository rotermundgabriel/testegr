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
const paymentLinksRoutes = require('./routes/payment-links'); // NOVA ROTA ADICIONADA
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
        environment: process.env.NODE_ENV || 'development',
        testMode: process.env.MP_TEST_MODE === 'true' // ADICIONADO
    });
});

// Rotas de autenticação (register e login são públicas)
app.use('/api/auth', authRoutes);

// =====================================
// WEBHOOK DO MERCADO PAGO (público mas validado)
// =====================================

app.post('/api/webhooks/mercadopago', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        console.log('[Webhook] Notificação recebida do Mercado Pago');
        
        const notification = JSON.parse(req.body.toString());
        console.log('[Webhook] Tipo:', notification.type, 'ID:', notification.data?.id);
        
        // Processar notificação de pagamento
        if (notification.type === 'payment' && notification.data?.id) {
            const Database = require('better-sqlite3');
            const db = new Database('database.db');
            const { checkPaymentStatus } = require('./services/mercadopago');
            
            // Buscar link pelo payment_id ou external_reference
            const stmt = db.prepare(`
                SELECT pl.*, u.access_token 
                FROM payment_links pl
                JOIN users u ON pl.user_id = u.id
                WHERE pl.payment_id = ? OR pl.external_reference = ?
            `);
            
            const link = stmt.get(notification.data.id, notification.data.id);
            
            if (link) {
                try {
                    // Verificar status no MP
                    const paymentStatus = await checkPaymentStatus(
                        link.access_token,
                        notification.data.id
                    );
                    
                    // Atualizar se aprovado
                    if (paymentStatus.status === 'approved' && link.status !== 'paid') {
                        const updateStmt = db.prepare(`
                            UPDATE payment_links 
                            SET 
                                status = 'paid',
                                payment_id = ?,
                                paid_at = ?,
                                payer_email = ?,
                                payment_method = ?
                            WHERE id = ?
                        `);
                        
                        updateStmt.run(
                            notification.data.id,
                            paymentStatus.dateApproved || new Date().toISOString(),
                            paymentStatus.payerEmail,
                            paymentStatus.paymentMethod,
                            link.id
                        );
                        
                        console.log('[Webhook] Pagamento aprovado e atualizado:', link.id);
                    }
                } catch (error) {
                    console.error('[Webhook] Erro ao processar pagamento:', error);
                }
            }
            
            db.close();
        }
        
        // Sempre retornar 200 para o MP
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('[Webhook] Erro ao processar webhook:', error);
        res.status(200).send('OK'); // Ainda retorna 200 para evitar retry
    }
});

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

// ROTAS DE PAYMENT LINKS (NOVA)
app.use('/api/payment-links', authMiddleware, paymentLinksRoutes);

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
    console.log(`💳 MP Test Mode: ${process.env.MP_TEST_MODE === 'true' ? 'Ativado' : 'Desativado'}`);
    console.log('=====================================');
    console.log('Endpoints disponíveis:');
    console.log('  POST /api/auth/register - Registrar novo usuário com credenciais MP');
    console.log('  POST /api/auth/login - Fazer login');
    console.log('  GET  /api/protected - Rota de teste (requer token)');
    console.log('  GET  /api/user/profile - Perfil do usuário (requer token)');
    console.log('  ');
    console.log('  Payment Links (requer autenticação):');
    console.log('  POST /api/payment-links/create - Criar link de pagamento PIX');
    console.log('  GET  /api/payment-links - Listar links do usuário');
    console.log('  GET  /api/payment-links/:id - Buscar link específico');
    console.log('  PATCH /api/payment-links/:id/cancel - Cancelar link');
    console.log('  POST /api/payment-links/:id/check-status - Verificar status');
    console.log('=====================================');
});

module.exports = app;
