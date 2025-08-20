// src/middleware/auth.js
const { verifyToken } = require('../services/auth');

/**
 * Middleware de autenticação JWT
 * Verifica o token no header Authorization e adiciona userId ao request
 */
function authMiddleware(req, res, next) {
    try {
        // Extrai o token do header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            console.log('Header Authorization não encontrado');
            return res.status(401).json({
                success: false,
                error: 'Token não fornecido'
            });
        }

        // Verifica o formato "Bearer [token]"
        const parts = authHeader.split(' ');
        
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            console.log('Formato inválido do header Authorization');
            return res.status(401).json({
                success: false,
                error: 'Formato de token inválido. Use: Bearer [token]'
            });
        }

        const token = parts[1];

        // Verifica e decodifica o token
        const decoded = verifyToken(token);

        // Adiciona o userId e outras informações ao request
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userName = decoded.name;

        // Log para debug
        console.log('Usuário autenticado:', {
            userId: req.userId,
            email: req.userEmail
        });

        // Continua para o próximo middleware/rota
        next();

    } catch (error) {
        console.error('Erro na autenticação:', error.message);
        
        // Retorna erro específico baseado no tipo
        if (error.message === 'Token expirado') {
            return res.status(401).json({
                success: false,
                error: 'Token expirado. Faça login novamente'
            });
        } else if (error.message === 'Token inválido') {
            return res.status(401).json({
                success: false,
                error: 'Token inválido'
            });
        } else if (error.message === 'JWT_SECRET não configurado') {
            console.error('ERRO CRÍTICO: JWT_SECRET não está configurado no .env');
            return res.status(500).json({
                success: false,
                error: 'Erro de configuração do servidor'
            });
        } else {
            return res.status(401).json({
                success: false,
                error: 'Falha na autenticação'
            });
        }
    }
}

/**
 * Middleware opcional de autenticação
 * Tenta autenticar mas não bloqueia se falhar
 * Útil para rotas que podem funcionar com ou sem autenticação
 */
function optionalAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            // Sem token, continua sem autenticação
            return next();
        }

        const parts = authHeader.split(' ');
        
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            // Formato inválido, continua sem autenticação
            return next();
        }

        const token = parts[1];

        try {
            // Tenta verificar o token
            const decoded = verifyToken(token);
            
            // Se sucesso, adiciona informações ao request
            req.userId = decoded.userId;
            req.userEmail = decoded.email;
            req.userName = decoded.name;
            
            console.log('Usuário autenticado (opcional):', req.userId);
        } catch (error) {
            // Token inválido, continua sem autenticação
            console.log('Token opcional inválido, continuando sem autenticação');
        }

        next();

    } catch (error) {
        // Qualquer erro, continua sem autenticação
        console.error('Erro no middleware opcional:', error);
        next();
    }
}

module.exports = {
    authMiddleware,
    optionalAuthMiddleware
};
