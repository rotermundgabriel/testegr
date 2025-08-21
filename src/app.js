// src/app.js
const { updatePaymentLinksTable } = require('./services/database-init');

// Atualizar banco automaticamente ao iniciar
console.log('🔄 Verificando atualizações do banco...');
updatePaymentLinksTable();

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
const paymentLinksRoutes = require('./routes/payment-links');

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
        testMode: process.env.MP_TEST_MODE === 'true'
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

// ROTAS DE PAYMENT LINKS
// Adicionar middleware de autenticação diretamente aqui também
app.use('/api/payment-links', authMiddleware, paymentLinksRoutes);

// Rota de estatísticas para o dashboard
app.get('/api/payment-links/stats', authMiddleware, async (req, res) => {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(process.cwd(), 'database.db'));
    
    try {
        const userId = req.userId;
        
        // Total de links
        const totalStmt = db.prepare('SELECT COUNT(*) as count FROM payment_links WHERE user_id = ?');
        const total = totalStmt.get(userId).count;
        
        // Links pagos
        const paidStmt = db.prepare('SELECT COUNT(*) as count FROM payment_links WHERE user_id = ? AND status = ?');
        const paid = paidStmt.get(userId, 'paid').count;
        
        // Links criados hoje
        const todayStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM payment_links 
            WHERE user_id = ? 
            AND date(created_at) = date('now')
        `);
        const today = todayStmt.get(userId).count;
        
        res.json({
            success: true,
            total,
            paid,
            today
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar estatísticas'
        });
    }
});

// =====================================
// ROTAS HTML (páginas do frontend)
// =====================================

// Páginas específicas que devem ser servidas
const htmlPages = [
    'index.html',
    'login.html', 
    'register.html',
    'dashboard.html',
    'create-link.html'
];

// Servir páginas HTML específicas
htmlPages.forEach(page => {
    const pageName = page.replace('.html', '');
    if (pageName !== 'index') {
        app.get(`/${pageName}`, (req, res) => {
            const filePath = path.join(__dirname, '..', 'public', page);
            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            } else {
                res.status(404).send('Página não encontrada');
            }
        });
    }
});

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// =====================================
// TRATAMENTO DE ERROS
// =====================================

// Rota não encontrada (404) para APIs
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado'
    });
});

// Para qualquer outra rota não definida, retornar 404
app.get('*', (req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - Página não encontrada</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .error-container {
                    text-align: center;
                    padding: 2rem;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                }
                h1 { color: #667eea; }
                p { color: #666; margin: 1rem 0; }
                a {
                    display: inline-block;
                    margin-top: 1rem;
                    padding: 0.75rem 1.5rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: transform 0.3s;
                }
                a:hover { transform: translateY(-2px); }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h1>404</h1>
                <p>Página não encontrada</p>
                <a href="/">Voltar ao início</a>
            </div>
        </body>
        </html>
    `);
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
    console.log('Páginas disponíveis:');
    console.log('  / - Página inicial');
    console.log('  /login - Login');
    console.log('  /register - Cadastro');
    console.log('  /dashboard - Dashboard');
    console.log('  /create-link - Criar link de pagamento');
    console.log('=====================================');
    console.log('Endpoints da API:');
    console.log('  POST /api/auth/register - Registrar novo usuário');
    console.log('  POST /api/auth/login - Fazer login');
    console.log('  GET  /api/payment-links - Listar links');
    console.log('  POST /api/payment-links/create - Criar link');
    console.log('  GET  /api/payment-links/stats - Estatísticas');
    console.log('=====================================');
});

module.exports = app;
