const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados (na raiz do projeto)
const DB_PATH = path.join(__dirname, '..', '..', 'database.db');

let db;
let isReady = false;

try {
  // Inicializar conexão com SQLite
  console.log('📂 Inicializando banco de dados...');
  console.log(`📍 Caminho do banco: ${DB_PATH}`);
  
  db = new Database(DB_PATH);
  
  // Configurações para melhor performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 1000');
  db.pragma('foreign_keys = ON');
  
  // Executar schema SQL para criar tabelas
  initializeSchema();
  
  isReady = true;
  console.log('✅ Banco de dados inicializado com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao inicializar banco de dados:', error);
  isReady = false;
}

function initializeSchema() {
  console.log('📋 Criando/atualizando tabelas do banco...');
  
  try {
    // Primeiro, verificar se a tabela users existe e sua estrutura
    const existingColumns = getTableColumns('users');
    
    if (existingColumns.length === 0) {
      // Tabela não existe, criar do zero
      console.log('🆕 Criando tabela users...');
      createUsersTable();
    } else {
      // Tabela existe, verificar se precisa de migração
      console.log('🔄 Verificando estrutura da tabela users...');
      migrateUsersTable(existingColumns);
    }
    
    // Criar outras tabelas
    createOtherTables();
    
    console.log('✅ Tabelas criadas/atualizadas com sucesso!');
    
    // Verificar estrutura final
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log('📊 Tabelas disponíveis:', tables.map(t => t.name).join(', '));
    
    // Mostrar estrutura da tabela users para debug
    const userColumns = getTableColumns('users');
    console.log('👤 Colunas da tabela users:', userColumns.map(c => c.name).join(', '));
    
  } catch (error) {
    console.error('❌ Erro ao criar/atualizar schema:', error);
    throw error;
  }
}

function getTableColumns(tableName) {
  try {
    return db.prepare(`PRAGMA table_info(${tableName})`).all();
  } catch (error) {
    return [];
  }
}

function createUsersTable() {
  const createUsersSql = `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      store_name TEXT NOT NULL,
      access_token TEXT,
      public_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.exec(createUsersSql);
  console.log('✅ Tabela users criada com sucesso!');
}

function migrateUsersTable(existingColumns) {
  const columnNames = existingColumns.map(col => col.name);
  const requiredColumns = [
    { name: 'name', type: 'TEXT NOT NULL DEFAULT ""' },
    { name: 'email', type: 'TEXT UNIQUE DEFAULT ""' },
    { name: 'password', type: 'TEXT NOT NULL DEFAULT ""' }
  ];
  
  let needsRecreation = false;
  
  // Verificar se colunas obrigatórias existem
  for (const column of requiredColumns) {
    if (!columnNames.includes(column.name)) {
      console.log(`📝 Coluna '${column.name}' não encontrada, será adicionada`);
      try {
        // Tentar adicionar coluna
        db.exec(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✅ Coluna '${column.name}' adicionada`);
      } catch (error) {
        console.log(`⚠️ Não foi possível adicionar coluna '${column.name}', será necessário recriar tabela`);
        needsRecreation = true;
        break;
      }
    }
  }
  
  // Se access_token e public_key eram NOT NULL e agora podem ser NULL
  if (!needsRecreation) {
    try {
      // Verificar se access_token é NOT NULL
      const accessTokenColumn = existingColumns.find(col => col.name === 'access_token');
      if (accessTokenColumn && accessTokenColumn.notnull === 1) {
        needsRecreation = true;
        console.log('🔄 access_token precisa ser nullable, recriando tabela...');
      }
    } catch (error) {
      // Se der erro, é mais seguro recriar
      needsRecreation = true;
    }
  }
  
  if (needsRecreation) {
    recreateUsersTable();
  }
}

function recreateUsersTable() {
  console.log('🔄 Recriando tabela users com nova estrutura...');
  
  // Backup dos dados existentes
  const existingUsers = db.prepare('SELECT * FROM users').all();
  console.log(`💾 Backup de ${existingUsers.length} usuários existentes`);
  
  // Remover tabela antiga
  db.exec('DROP TABLE IF EXISTS users');
  
  // Criar nova tabela
  createUsersTable();
  
  // Restaurar dados (com valores padrão para colunas novas)
  if (existingUsers.length > 0) {
    const insertStmt = db.prepare(`
      INSERT INTO users (id, name, email, password, store_name, access_token, public_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const user of existingUsers) {
      try {
        insertStmt.run(
          user.id,
          user.name || user.store_name || 'Usuário',
          user.email || `user${user.id}@temp.com`,
          user.password || 'temp_password_change_me',
          user.store_name,
          user.access_token,
          user.public_key,
          user.created_at
        );
      } catch (error) {
        console.error(`⚠️ Erro ao restaurar usuário ${user.id}:`, error.message);
      }
    }
    
    console.log('✅ Dados restaurados na nova estrutura');
  }
}

function createOtherTables() {
  // Tabela de links de pagamento
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'expired', 'cancelled')),
      payment_id TEXT,
      payer_email TEXT,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Índices para melhorar performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  // Tabela de webhooks/notificações
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_notifications (
      id TEXT PRIMARY KEY,
      link_id TEXT NOT NULL,
      mp_notification_id TEXT,
      status TEXT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (link_id) REFERENCES payment_links(id)
    )
  `);
}

// Função para executar script de inicialização manual
function initDatabase() {
  if (!isReady) {
    throw new Error('Banco de dados não está pronto');
  }
  
  console.log('🔄 Reinicializando schema do banco...');
  initializeSchema();
  console.log('✅ Banco reinicializado!');
}

// Função para fechar conexão (útil em testes)
function closeDatabase() {
  if (db) {
    db.close();
    console.log('🔒 Conexão com banco fechada');
  }
}

// Função para obter estatísticas do banco
function getStats() {
  if (!isReady) return null;
  
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const linkCount = db.prepare('SELECT COUNT(*) as count FROM payment_links').get().count;
    const paidCount = db.prepare("SELECT COUNT(*) as count FROM payment_links WHERE status = 'paid'").get().count;
    
    return {
      users: userCount,
      links: linkCount,
      paid_links: paidCount
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    return null;
  }
}

// Função para verificar estrutura de uma tabela
function getTableStructure(tableName = 'users') {
  if (!isReady) return null;
  
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.map(col => ({
      name: col.name,
      type: col.type,
      notNull: col.notnull === 1,
      defaultValue: col.dflt_value,
      primaryKey: col.pk === 1
    }));
  } catch (error) {
    console.error(`Erro ao obter estrutura da tabela ${tableName}:`, error);
    return null;
  }
}

// Exportar instância do banco e funções utilitárias
module.exports = {
  db,
  isReady,
  initDatabase,
  closeDatabase,
  getStats,
  getTableStructure
};

// Se executado diretamente (npm run init-db)
if (require.main === module) {
  initDatabase();
}
