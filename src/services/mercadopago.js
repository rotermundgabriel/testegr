// src/services/mercadopago.js
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { v4: uuidv4 } = require('uuid');
const { decryptAccessToken } = require('../utils/crypto');

/**
 * Cria uma instância do cliente Mercado Pago com o access token do usuário
 * @param {string} encryptedAccessToken - Token criptografado
 * @returns {MercadoPagoConfig} - Cliente configurado
 */
function createMPClient(encryptedAccessToken) {
  try {
    const accessToken = decryptAccessToken(encryptedAccessToken);
    
    const client = new MercadoPagoConfig({
      accessToken: accessToken,
      options: {
        timeout: 5000,
        idempotencyKey: uuidv4()
      }
    });
    
    console.log('[MP Service] Cliente Mercado Pago criado com sucesso');
    return client;
  } catch (error) {
    console.error('[MP Service] Erro ao criar cliente MP:', error.message);
    throw new Error('Falha ao configurar integração com Mercado Pago');
  }
}

/**
 * Cria um link de pagamento (preference) no Mercado Pago
 * @param {Object} params - Parâmetros do pagamento
 * @returns {Object} - Dados do link criado
 */
async function createPaymentLink(params) {
  const {
    accessToken,
    title,
    amount,
    customerEmail,
    customerName,
    customerCpf,
    externalReference
  } = params;
  
  try {
    console.log('[MP Service] Criando link de pagamento:', {
      title,
      amount,
      externalReference
    });
    
    // Criar cliente MP
    const client = createMPClient(accessToken);
    const preference = new Preference(client);
    
    // Configurar data de expiração (24 horas)
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 24);
    
    // Limpar CPF (remover formatação)
    const cleanCpf = customerCpf ? customerCpf.replace(/\D/g, '') : '';
    
    // Criar preference
    const preferenceData = {
      items: [
        {
          id: externalReference,
          title: title || 'Pagamento via PIX',
          description: `Pagamento: ${title}`,
          quantity: 1,
          unit_price: parseFloat(amount),
          currency_id: 'BRL'
        }
      ],
      payer: {
        email: customerEmail,
        name: customerName,
        identification: cleanCpf ? {
          type: 'CPF',
          number: cleanCpf
        } : undefined
      },
      payment_methods: {
        //excluded_payment_types: [
          //{ id: 'credit_card' },
          //{ id: 'debit_card' },
          //{ id: 'ticket' },
          //{ id: 'atm' },
          //{ id: 'bank_transfer' }
        //],
        excluded_payment_methods: [
          { id: 'bolbradesco' }
        ],
        installments: 1
      },
      expires: true,
      expiration_date_to: expirationDate.toISOString(),
      external_reference: externalReference,
      back_urls: {
        success: `${process.env.APP_URL || 'https://mercadopago-link-generator-production.up.railway.app'}/payment/success`,
        failure: `${process.env.APP_URL || 'https://mercadopago-link-generator-production.up.railway.app'}/payment/failure`,
        pending: `${process.env.APP_URL || 'https://mercadopago-link-generator-production.up.railway.app'}/payment/pending`
      },
      notification_url: `${process.env.APP_URL || 'https://mercadopago-link-generator-production.up.railway.app'}/api/webhooks/mercadopago`,
      statement_descriptor: title ? title.substring(0, 22) : 'Pagamento',
      binary_mode: false // Permite pending status para PIX
    };
    
    console.log('[MP Service] Enviando preference para MP...');
    const response = await preference.create({ body: preferenceData });
    
    if (!response || !response.init_point) {
      throw new Error('Resposta inválida do Mercado Pago');
    }
    
    console.log('[MP Service] Link criado com sucesso:', {
      id: response.id,
      external_reference: response.external_reference
    });
    
    return {
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point,
     // externalReference: response.external_reference,
      expirationDate: expirationDate.toISOString()
    };
    
  } catch (error) {
    console.error('[MP Service] Erro ao criar link de pagamento:', error);
    
    // Tratar erros específicos do MP
    if (error.status === 401) {
      throw new Error('Credenciais do Mercado Pago inválidas');
    } else if (error.status === 400) {
      const message = error.message || 'Dados inválidos';
      throw new Error(`Erro do Mercado Pago: ${message}`);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      throw new Error('Não foi possível conectar ao Mercado Pago. Tente novamente.');
    }
    
    throw new Error('Falha ao criar link de pagamento: ' + error.message);
  }
}

/**
 * Verifica o status de um pagamento no Mercado Pago
 * @param {string} accessToken - Token de acesso criptografado
 * @param {string} paymentId - ID do pagamento no MP
 * @returns {Object} - Status e detalhes do pagamento
 */
async function checkPaymentStatus(accessToken, paymentId) {
  try {
    console.log('[MP Service] Verificando status do pagamento:', paymentId);
    
    const client = createMPClient(accessToken);
    const payment = new Payment(client);
    
    const response = await payment.get({ id: paymentId });
    
    if (!response) {
      throw new Error('Pagamento não encontrado');
    }
    
    console.log('[MP Service] Status do pagamento:', {
      id: response.id,
      status: response.status,
      status_detail: response.status_detail
    });
    
    return {
      id: response.id,
      status: response.status,
      statusDetail: response.status_detail,
      paymentMethod: response.payment_method_id,
      transactionAmount: response.transaction_amount,
      paidAmount: response.transaction_details?.total_paid_amount,
      payerEmail: response.payer?.email,
      dateApproved: response.date_approved,
      dateCreated: response.date_created
    };
    
  } catch (error) {
    console.error('[MP Service] Erro ao verificar status:', error);
    
    if (error.status === 404) {
      throw new Error('Pagamento não encontrado');
    }
    
    throw new Error('Falha ao verificar status do pagamento');
  }
}

/**
 * Busca uma preference pelo ID
 * @param {string} accessToken - Token de acesso criptografado
 * @param {string} preferenceId - ID da preference
 * @returns {Object} - Dados da preference
 */
async function getPreference(accessToken, preferenceId) {
  try {
    console.log('[MP Service] Buscando preference:', preferenceId);
    
    const client = createMPClient(accessToken);
    const preference = new Preference(client);
    
    const response = await preference.get({ preferenceId });
    
    if (!response) {
      throw new Error('Preference não encontrada');
    }
    
    return {
      id: response.id,
     // externalReference: response.external_reference,
      status: response.expires ? 'active' : 'inactive',
      items: response.items,
      payer: response.payer,
      dateCreated: response.date_created
    };
    
  } catch (error) {
    console.error('[MP Service] Erro ao buscar preference:', error);
    throw new Error('Falha ao buscar dados do link de pagamento');
  }
}

/**
 * Cancela uma preference (desativa o link)
 * @param {string} accessToken - Token de acesso criptografado
 * @param {string} preferenceId - ID da preference
 * @returns {boolean} - Sucesso da operação
 */
async function cancelPreference(accessToken, preferenceId) {
  try {
    console.log('[MP Service] Cancelando preference:', preferenceId);
    
    const client = createMPClient(accessToken);
    const preference = new Preference(client);
    
    // Atualizar preference para expirada
    await preference.update({
      id: preferenceId,
      updatePreferenceRequest: {
        expires: true,
        expiration_date_to: new Date().toISOString() // Expira imediatamente
      }
    });
    
    console.log('[MP Service] Preference cancelada com sucesso');
    return true;
    
  } catch (error) {
    console.error('[MP Service] Erro ao cancelar preference:', error);
    throw new Error('Falha ao cancelar link de pagamento');
  }
}

module.exports = {
  createMPClient,
  createPaymentLink,
  checkPaymentStatus,
  getPreference,
  cancelPreference
};
