// Script para testar a API - versão corrigida
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
        password: 'senha123',
        store_name: 'Loja Teste' // Adicionando campo que pode estar faltando
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
        console.log('Resposta do registro:', registerData);
        
        if (registerResponse.ok) {
            console.log('✅ Usuário registrado com sucesso!');
            if (registerData.token) {
                token = registerData.token;
                console.log('🔑 Token obtido no registro');
            }
        } else {
            console.log('⚠️  Erro no registro:', registerData.error || registerData.message);
        }
    } catch (error) {
        console.error('❌ Erro ao registrar:', error.message);
    }
    
    // Se não conseguiu token no registro, tenta login
    if (!token) {
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
            console.log('Resposta do login:', loginData);
            
            if (loginResponse.ok && loginData.token) {
                token = loginData.token;
                console.log('✅ Login realizado com sucesso!');
                console.log('🔑 Token:', token.substring(0, 20) + '...');
            } else {
                console.error('❌ Erro no login:', loginData.error || loginData.message);
                return;
            }
        } catch (error) {
            console.error('❌ Erro ao fazer login:', error.message);
            return;
        }
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
        
        console.log('📤 Dados enviados:', JSON.stringify(linkData, null, 2));
        
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
            
            // Salvar dados para uso no navegador
            console.log('\n💾 Salvando dados para teste no navegador...');
            const testData = {
                token: token,
                user: testUser,
                lastLink: createData
            };
            require('fs').writeFileSync('test-data.json', JSON.stringify(testData, null, 2));
            console.log('✅ Dados salvos em test-data.json');
            
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