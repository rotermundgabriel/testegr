// src/routes/payment-links.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const { createPaymentLink, checkPaymentStatus } = require('../services/mercadopago');
const { authMiddleware } = require('../middleware/auth');

// Inicializar banco de dados
const db = new Database('database.db');

/**
 * Validar CPF (formato básico)
 */
function isValidCPF(cpf) {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.length === 11;
}

/**
 * Validar email (formato básico)
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * POST /api/payment-links/create
 * Criar novo link de pagamento
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { 
      title, 
      amount, 
      customer_email, 
      customer_name, 
      customer_cpf 
    } = req.body;
    
    console.log('[Route] Criando link de pagamento para usuário:', userId);
    console.log('[Route] Dados recebidos:', { title, amount, customer_email });
    
    // Validações
    if (!title || title.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Título é obrigatório e deve ter no máximo 200 caracteres'
      });
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Valor deve ser entre R$ 0,01 e R$ 10.000,00'
      });
    }
    
    if (!customer_email || !isValidEmail(customer_email)) {
      return res.status(400).json({
        success: false,
        error: 'Email do cliente é obrigatório e deve ser válido'
      });
    }
    
    if (!customer_name || customer_name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Nome do cliente é obrigatório'
      });
    }
    
    if (customer_cpf && !isValidCPF(customer_cpf)) {
      return res.status(400).json({
        success: false,
        error: 'CPF inválido. Use o formato: 000.000.000-00 ou apenas números'
      });
    }
    
    // Buscar credenciais do usuário
    const userStmt = db.prepare('SELECT access_token, public_key FROM users WHERE id = ?');
    const user = userStmt.get(userId);
    
    if (!user || !user.access_token) {
      console.error('[Route] Usuário sem credenciais configuradas:', userId);
      return res.status(400).json({
        success: false,
        error: 'Configure suas credenciais do Mercado Pago antes de criar links'
      });
    }
    
    // Gerar IDs únicos
    const linkId = uuidv4();
    const externalReference = uuidv4();
    
    try {
      // Criar link no Mercado Pago
      console.log('[Route] Chamando serviço MP para criar link...');
      const mpResult = await createPaymentLink({
        accessToken: user.access_token,
        title,
        amount: numAmount,
        customerEmail: customer_email,
        customerName: customer_name,
        customerCpf: customer_cpf,
        externalReference
      });
      
      console.log('[Route] Link criado no MP:', mpResult.preferenceId);
      
      // Salvar no banco de dados
      const insertStmt = db.prepare(`
        INSERT INTO payment_links (
          id, 
          user_id, 
          description, 
          amount, 
          status, 
          external_reference,
          mp_preference_id,
          init_point,
          sandbox_init_point,
          customer_email,
          customer_name,
          customer_cpf,
          expires_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      
      const isTestMode = process.env.MP_TEST_MODE === 'true';
      const linkUrl = isTestMode ? mpResult.sandboxInitPoint : mpResult.initPoint;
      
      insertStmt.run(
        linkId,
        userId,
        title,
        numAmount,
        'pending',
        externalReference,
        mpResult.preferenceId,
        mpResult.initPoint,
        mpResult.sandboxInitPoint,
        customer_email,
        customer_name,
        customer_cpf || null,
        mpResult.expirationDate
      );
      
      console.log('[Route] Link salvo no banco:', linkId);
      
      // Resposta de sucesso
      res.json({
        success: true,
        link: linkUrl,
        id: linkId,
        external_reference: externalReference,
        preference_id: mpResult.preferenceId,
        expires_at: mpResult.expirationDate,
        message: 'Link de pagamento criado com sucesso'
      });
      
    } catch (mpError) {
      console.error('[Route] Erro ao criar link no MP:', mpError);
      
      // Tratar erros específicos
      if (mpError.message.includes('Credenciais')) {
        return res.status(401).json({
          success: false,
          error: 'Credenciais do Mercado Pago inválidas. Verifique suas configurações.'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: mpError.message || 'Erro ao criar link de pagamento'
      });
    }
    
  } catch (error) {
    console.error('[Route] Erro geral ao criar link:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao processar solicitação'
    });
  }
});

/**
 * GET /api/payment-links
 * Listar todos os links do usuário
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { status, limit = 50, offset = 0 } = req.query;
    
    console.log('[Route] Listando links do usuário:', userId);
    
    // Query base
    let query = `
      SELECT 
        id,
        description,
        amount,
        status,
        external_reference,
        mp_preference_id,
        init_point,
        customer_email,
        customer_name,
        payment_id,
        payer_email,
        payment_method,
        expires_at,
        created_at,
        paid_at
      FROM payment_links 
      WHERE user_id = ?
    `;
    
    const params = [userId];
    
    // Filtro por status se fornecido
    if (status && ['pending', 'paid', 'expired', 'cancelled'].includes(status)) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    // Ordenação e paginação
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const stmt = db.prepare(query);
    const links = stmt.all(...params);
    
    // Verificar links expirados
    const now = new Date();
    const updatedLinks = links.map(link => {
      if (link.status === 'pending' && link.expires_at) {
        const expiresAt = new Date(link.expires_at);
        if (expiresAt < now) {
          // Atualizar status para expirado
          const updateStmt = db.prepare('UPDATE payment_links SET status = ? WHERE id = ?');
          updateStmt.run('expired', link.id);
          link.status = 'expired';
        }
      }
      return link;
    });
    
    // Contar total de links
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM payment_links WHERE user_id = ?');
    const { total } = countStmt.get(userId);
    
    console.log(`[Route] Encontrados ${updatedLinks.length} links de ${total} total`);
    
    res.json({
      success: true,
      links: updatedLinks,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('[Route] Erro ao listar links:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar links de pagamento'
    });
  }
});

/**
 * GET /api/payment-links/:id
 * Buscar link específico
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const linkId = req.params.id;
    
    console.log('[Route] Buscando link:', linkId);
    
    const stmt = db.prepare(`
      SELECT 
        id,
        user_id,
        description,
        amount,
        status,
        external_reference,
        mp_preference_id,
        init_point,
        sandbox_init_point,
        customer_email,
        customer_name,
        customer_cpf,
        payment_id,
        payer_email,
        payment_method,
        expires_at,
        created_at,
        paid_at
      FROM payment_links 
      WHERE id = ? AND user_id = ?
    `);
    
    const link = stmt.get(linkId, userId);
    
    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'Link de pagamento não encontrado'
      });
    }
    
    // Verificar se expirou
    if (link.status === 'pending' && link.expires_at) {
      const expiresAt = new Date(link.expires_at);
      if (expiresAt < new Date()) {
        // Atualizar status
        const updateStmt = db.prepare('UPDATE payment_links SET status = ? WHERE id = ?');
        updateStmt.run('expired', linkId);
        link.status = 'expired';
      }
    }
    
    // Determinar URL baseado no modo
    const isTestMode = process.env.MP_TEST_MODE === 'true';
    link.payment_url = isTestMode ? link.sandbox_init_point : link.init_point;
    
    console.log('[Route] Link encontrado:', link.id);
    
    res.json({
      success: true,
      link
    });
    
  } catch (error) {
    console.error('[Route] Erro ao buscar link:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar link de pagamento'
    });
  }
});

/**
 * PATCH /api/payment-links/:id/cancel
 * Cancelar link de pagamento
 */
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const linkId = req.params.id;
    
    console.log('[Route] Cancelando link:', linkId);
    
    // Verificar se o link pertence ao usuário
    const linkStmt = db.prepare('SELECT * FROM payment_links WHERE id = ? AND user_id = ?');
    const link = linkStmt.get(linkId, userId);
    
    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'Link de pagamento não encontrado'
      });
    }
    
    if (link.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Não é possível cancelar um link com status: ${link.status}`
      });
    }
    
    // Atualizar status no banco
    const updateStmt = db.prepare('UPDATE payment_links SET status = ? WHERE id = ?');
    updateStmt.run('cancelled', linkId);
    
    console.log('[Route] Link cancelado com sucesso');
    
    res.json({
      success: true,
      message: 'Link de pagamento cancelado com sucesso'
    });
    
  } catch (error) {
    console.error('[Route] Erro ao cancelar link:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao cancelar link de pagamento'
    });
  }
});

/**
 * POST /api/payment-links/:id/check-status
 * Verificar status de pagamento no Mercado Pago
 */
router.post('/:id/check-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const linkId = req.params.id;
    
    console.log('[Route] Verificando status do pagamento:', linkId);
    
    // Buscar link e credenciais
    const stmt = db.prepare(`
      SELECT 
        pl.*,
        u.access_token
      FROM payment_links pl
      JOIN users u ON pl.user_id = u.id
      WHERE pl.id = ? AND pl.user_id = ?
    `);
    
    const result = stmt.get(linkId, userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Link de pagamento não encontrado'
      });
    }
    
    if (!result.payment_id) {
      return res.json({
        success: true,
        status: result.status,
        message: 'Pagamento ainda não foi iniciado'
      });
    }
    
    try {
      // Verificar status no MP
      const paymentStatus = await checkPaymentStatus(
        result.access_token,
        result.payment_id
      );
      
      // Atualizar banco se necessário
      if (paymentStatus.status === 'approved' && result.status !== 'paid') {
        const updateStmt = db.prepare(`
          UPDATE payment_links 
          SET 
            status = 'paid',
            paid_at = ?,
            payer_email = ?,
            payment_method = ?
          WHERE id = ?
        `);
        
        updateStmt.run(
          paymentStatus.dateApproved || new Date().toISOString(),
          paymentStatus.payerEmail,
          paymentStatus.paymentMethod,
          linkId
        );
        
        console.log('[Route] Status atualizado para PAGO');
      }
      
      res.json({
        success: true,
        payment_status: paymentStatus.status,
        payment_details: paymentStatus
      });
      
    } catch (mpError) {
      console.error('[Route] Erro ao verificar status no MP:', mpError);
      res.json({
        success: true,
        status: result.status,
        message: 'Não foi possível verificar status no Mercado Pago'
      });
    }
    
  } catch (error) {
    console.error('[Route] Erro ao verificar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar status do pagamento'
    });
  }
});

module.exports = router;
