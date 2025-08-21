// Script para criar usuário de teste diretamente no banco
const Database = require('better-sqlite3');
const { hashPassword } = require('./src/services/auth');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
    const db = new Database('database.db');
    
    try {
        // Dados do usuário de teste
        const userData = {
            id: uuidv4(),
            email: 'teste@example.com',
            password: await hashPassword('senha123'),
            name: 'Usuário Teste',
            store_name: 'Loja Teste',
            // Tokens de teste do Mercado Pago (não funcionais, apenas para teste)
            access_token: 'TEST-1234567890123456-123456-abcdefghijklmnopqrstuvwxyz123456-123456789',
            public_key: 'TEST-12345678-1234-1234-1234-123456789012',
            created_at: new Date().toISOString()
        };
        
        // Inserir usuário
        const stmt = db.prepare(`
            INSERT INTO users (id, email, password, name, store_name, access_token, public_key, created_at)
            VALUES (@id, @email, @password, @name, @store_name, @access_token, @public_key, @created_at)
        `);
        
        stmt.run(userData);
        
        console.log('✅ Usuário de teste criado com sucesso!');
        console.log('📧 Email:', userData.email);
        console.log('🔑 Senha: senha123');
        console.log('🆔 ID:', userData.id);
        
    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error.message);
    } finally {
        db.close();
    }
}

createTestUser();