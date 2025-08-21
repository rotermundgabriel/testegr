// Script para testar login e criação de link com usuário existente
const API_URL = 'http://localhost:3000';

async function testWithUser() {
    console.log('🚀 Testando com usuário existente...\n');
    
    let token = '';
    
    // 1. Fazer login
    try {
        console.log('🔐 Fazendo login...');
        const loginResponse = await fetch(API_URL + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'teste@example.com',
                password: 'senha123'
            })
        });
        
        const loginData = await loginResponse.json();
        
        if (loginResponse.ok && loginData.token) {
            token = loginData.token;
            console.log('✅ Login realizado com sucesso!');
            console.log('🔑 Token:', token.substring(0, 30) + '...');
            console.log('👤 Usuário:', loginData.user.name);
            console.log('📧 Email:', loginData.user.email);
            
            // Salvar token no localStorage simulado
            const fs = require('fs');
            fs.writeFileSync('test-token.txt', token);
            console.log('\n💾 Token salvo em test-token.txt para uso no navegador');
            
        } else {
            console.error('❌ Erro no login:', loginData);
            return;
        }
    } catch (error) {
        console.error('❌ Erro ao fazer login:', error.message);
        return;
    }
    
    // 2. Testar criação de link
    try {
        console.log('\n🔗 Criando link de pagamento...');
        const linkData = {
            title: 'Produto de Teste',
            amount: 49.90,
            customer_email: 'cliente@example.com',
            customer_name: 'Maria Santos',
            customer_cpf: '12345678901'
        };
        
        console.log('📤 Enviando dados:', JSON.stringify(linkData, null, 2));
        
        const createResponse = await fetch(API_URL + '/api/payment-links/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(linkData)
        });
        
        const createData = await createResponse.json();
        console.log('\n📥 Resposta do servidor:');
        console.log('Status:', createResponse.status);
        console.log('Dados:', JSON.stringify(createData, null, 2));
        
        if (createResponse.ok) {
            console.log('\n✅ Link criado com sucesso!');
            if (createData.id) {
                const paymentUrl = `${API_URL}/pay/${createData.id}`;
                console.log('🆔 ID do link:', createData.id);
                console.log('🌐 URL de pagamento:', paymentUrl);
                console.log('\n📋 Para testar no navegador:');
                console.log('1. Abra o arquivo create-link.html');
                console.log('2. Use o token salvo em test-token.txt');
                console.log('3. Ou acesse diretamente:', paymentUrl);
            }
        } else {
            console.error('\n❌ Erro ao criar link:', createData.error || createData.message);
            if (createData.error === 'Configure suas credenciais do Mercado Pago antes de criar links') {
                console.log('\n⚠️  Nota: Este erro ocorre porque estamos usando credenciais de teste.');
                console.log('Em produção, você precisará de credenciais reais do Mercado Pago.');
            }
        }
    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
    }
}

// Executar teste
testWithUser().then(() => {
    console.log('\n✨ Teste concluído!');
}).catch(error => {
    console.error('\n💥 Erro geral:', error);
});