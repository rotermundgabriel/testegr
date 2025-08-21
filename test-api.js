// Script para testar a API
const API_URL = 'http://localhost:3000';

async function testAPI() {
    console.log('🚀 Iniciando teste da API...\n');
    
    // 1. Testar se o servidor está rodando
    try {
        const serverResponse = await fetch(API_URL + '/');
        console.log('✅ Servidor está rodando!');
    } catch (error) {
        console.error('❌ Servidor não está respondendo:', error.message);
        return;
    }
    
    // 2. Criar/Login usuário de teste
    const testUser = {
        name: 'Usuário Teste',
        email: 'teste@example.com',
        password: 'senha123'
    };
    
    let token = '';
    
    // Tentar registrar
    try {
        console.log('\n📝 Tentando registrar usuário de teste...');
        const registerResponse = await fetch(API_URL + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const registerData = await registerResponse.json();
        if (registerResponse.ok) {
            console.log('✅ Usuário registrado com sucesso!');
        } else {
            console.log('⚠️  Usuário já existe ou erro:', registerData.error);
        }
    } catch (error) {
        console.error('❌ Erro ao registrar:', error.message);
    }
    
    // Fazer login
    try {
        console.log('\n🔐 Fazendo login...');
        const loginResponse = await fetch(API_URL + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password
            })
        });
        
        const loginData = await loginResponse.json();
        if (loginResponse.ok && loginData.token) {
            token = loginData.token;
            console.log('✅ Login realizado com sucesso!');
            console.log('🔑 Token:', token.substring(0, 20) + '...');
        } else {
            console.error('❌ Erro no login:', loginData);
            return;
        }
    } catch (error) {
        console.error('❌ Erro ao fazer login:', error.message);
        return;
    }
    
    // 3. Testar criação de link
    try {
        console.log('\n🔗 Criando link de pagamento...');
        const linkData = {
            title: 'Teste de Link via API',
            amount: 25.99,
            customer_email: 'cliente@example.com',
            customer_name: 'João da Silva',
            customer_cpf: '12345678901'
        };
        
        console.log('📤 Dados enviados:', linkData);
        
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
            if (createData.link) {
                console.log('🌐 URL do link:', createData.link);
            } else if (createData.id) {
                console.log('🆔 ID do link:', createData.id);
                console.log('🌐 URL do link:', `${API_URL}/pay/${createData.id}`);
            }
        } else {
            console.error('\n❌ Erro ao criar link:', createData.error || createData.message);
        }
    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
    }
}

// Executar teste
testAPI().then(() => {
    console.log('\n✨ Teste concluído!');
}).catch(error => {
    console.error('\n💥 Erro geral:', error);
});