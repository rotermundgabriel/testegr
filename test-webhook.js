/**
 * Script de teste para o webhook do Mercado Pago
 * Simula notificações de pagamento para testar a integração
 */

const fetch = require('node-fetch');
require('dotenv').config();

// Configurações
const WEBHOOK_URL = process.env.APP_URL || 'http://localhost:3000';
const WEBHOOK_ENDPOINT = '/api/webhooks/mercadopago';

// Cores para o console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

// Função para enviar notificação de teste
async function sendTestNotification(type, paymentId, status = 'approved') {
    const notification = {
        id: `test_notif_${Date.now()}`,
        live_mode: false,
        type: type,
        date_created: new Date().toISOString(),
        user_id: 'test_user',
        api_version: 'v1',
        action: 'payment.created',
        data: {
            id: paymentId
        }
    };

    console.log(`\n${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}📤 Enviando notificação de teste${colors.reset}`);
    console.log(`${colors.blue}Tipo:${colors.reset} ${type}`);
    console.log(`${colors.blue}Payment ID:${colors.reset} ${paymentId}`);
    console.log(`${colors.blue}URL:${colors.reset} ${WEBHOOK_URL}${WEBHOOK_ENDPOINT}`);
    
    try {
        const response = await fetch(`${WEBHOOK_URL}${WEBHOOK_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Test-Notification': 'true'
            },
            body: JSON.stringify(notification)
        });

        const statusCode = response.status;
        const responseText = await response.text();

        if (statusCode === 200) {
            console.log(`${colors.green}✅ Resposta recebida:${colors.reset} ${statusCode} - ${responseText}`);
        } else {
            console.log(`${colors.red}❌ Erro na resposta:${colors.reset} ${statusCode} - ${responseText}`);
        }

        return { success: statusCode === 200, statusCode, response: responseText };
    } catch (error) {
        console.error(`${colors.red}❌ Erro ao enviar notificação:${colors.reset}`, error.message);
        return { success: false, error: error.message };
    }
}

// Função para simular fluxo completo de pagamento
async function simulatePaymentFlow(linkId) {
    console.log(`\n${colors.bright}${colors.cyan}🚀 INICIANDO SIMULAÇÃO DE PAGAMENTO${colors.reset}`);
    console.log(`${colors.yellow}Link ID:${colors.reset} ${linkId}`);
    
    // 1. Simular notificação de pagamento pendente
    console.log(`\n${colors.yellow}1️⃣ Simulando pagamento pendente...${colors.reset}`);
    await sendTestNotification('payment', linkId, 'pending');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Simular notificação de pagamento aprovado
    console.log(`\n${colors.green}2️⃣ Simulando pagamento aprovado...${colors.reset}`);
    await sendTestNotification('payment', linkId, 'approved');
    
    console.log(`\n${colors.bright}${colors.green}✅ Simulação concluída!${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);
}

// Menu interativo
async function interactiveMenu() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log(`\n${colors.bright}${colors.cyan}🧪 TESTE DE WEBHOOK - MERCADO PAGO${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.yellow}Webhook URL:${colors.reset} ${WEBHOOK_URL}${WEBHOOK_ENDPOINT}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

    while (true) {
        console.log(`${colors.bright}Escolha uma opção:${colors.reset}`);
        console.log('1. Enviar notificação de pagamento aprovado');
        console.log('2. Enviar notificação de pagamento pendente');
        console.log('3. Enviar notificação de pagamento rejeitado');
        console.log('4. Simular fluxo completo de pagamento');
        console.log('5. Enviar notificação customizada');
        console.log('0. Sair\n');

        const choice = await question(`${colors.cyan}Opção: ${colors.reset}`);

        switch (choice) {
            case '1':
                const paymentId1 = await question('Digite o ID do pagamento (ou pressione Enter para usar ID aleatório): ');
                await sendTestNotification('payment', paymentId1 || `test_payment_${Date.now()}`, 'approved');
                break;

            case '2':
                const paymentId2 = await question('Digite o ID do pagamento (ou pressione Enter para usar ID aleatório): ');
                await sendTestNotification('payment', paymentId2 || `test_payment_${Date.now()}`, 'pending');
                break;

            case '3':
                const paymentId3 = await question('Digite o ID do pagamento (ou pressione Enter para usar ID aleatório): ');
                await sendTestNotification('payment', paymentId3 || `test_payment_${Date.now()}`, 'rejected');
                break;

            case '4':
                const linkId = await question('Digite o ID do link de pagamento: ');
                if (linkId) {
                    await simulatePaymentFlow(linkId);
                } else {
                    console.log(`${colors.red}ID do link é obrigatório para esta opção${colors.reset}`);
                }
                break;

            case '5':
                const customType = await question('Tipo de notificação (payment/merchant_order): ');
                const customId = await question('ID do pagamento/pedido: ');
                const customStatus = await question('Status (approved/pending/rejected): ');
                await sendTestNotification(customType || 'payment', customId || `custom_${Date.now()}`, customStatus || 'approved');
                break;

            case '0':
                console.log(`\n${colors.green}Saindo...${colors.reset}\n`);
                rl.close();
                process.exit(0);

            default:
                console.log(`${colors.red}Opção inválida!${colors.reset}\n`);
        }

        console.log(''); // Linha em branco para separação
    }
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length === 0) {
    // Modo interativo
    interactiveMenu();
} else if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
${colors.bright}Uso:${colors.reset}
  node test-webhook.js                    - Modo interativo
  node test-webhook.js <payment_id>       - Enviar notificação de pagamento aprovado
  node test-webhook.js <link_id> flow     - Simular fluxo completo
  node test-webhook.js --help             - Mostrar esta ajuda

${colors.bright}Exemplos:${colors.reset}
  node test-webhook.js 123456789
  node test-webhook.js abc-def-ghi flow
    `);
} else if (args[1] === 'flow') {
    // Simular fluxo completo
    simulatePaymentFlow(args[0]).then(() => process.exit(0));
} else {
    // Enviar notificação única
    sendTestNotification('payment', args[0], 'approved').then(() => process.exit(0));
}