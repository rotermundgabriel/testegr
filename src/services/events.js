/**
 * Serviço de Server-Sent Events (SSE)
 * Gerencia conexões e envia atualizações em tempo real para o dashboard
 */

class EventService {
  constructor() {
    // Armazena as conexões SSE ativas por usuário
    this.connections = new Map();
    
    // Contador de conexões para debug
    this.connectionCounter = 0;
  }

  /**
   * Adiciona uma nova conexão SSE
   * @param {string} userId - ID do usuário
   * @param {Response} res - Objeto response do Express
   * @returns {string} - ID da conexão
   */
  addConnection(userId, res) {
    const connectionId = `${userId}_${Date.now()}_${++this.connectionCounter}`;
    
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Map());
    }
    
    const userConnections = this.connections.get(userId);
    userConnections.set(connectionId, res);
    
    console.log(`[SSE] Nova conexão estabelecida: ${connectionId}`);
    console.log(`[SSE] Total de conexões do usuário ${userId}: ${userConnections.size}`);
    
    return connectionId;
  }

  /**
   * Remove uma conexão SSE
   * @param {string} userId - ID do usuário
   * @param {string} connectionId - ID da conexão
   */
  removeConnection(userId, connectionId) {
    const userConnections = this.connections.get(userId);
    
    if (userConnections) {
      userConnections.delete(connectionId);
      console.log(`[SSE] Conexão removida: ${connectionId}`);
      
      // Remove o Map do usuário se não houver mais conexões
      if (userConnections.size === 0) {
        this.connections.delete(userId);
        console.log(`[SSE] Todas as conexões do usuário ${userId} foram removidas`);
      }
    }
  }

  /**
   * Envia um evento para um usuário específico
   * @param {string} userId - ID do usuário
   * @param {string} eventType - Tipo do evento
   * @param {Object} data - Dados do evento
   */
  sendToUser(userId, eventType, data) {
    const userConnections = this.connections.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      console.log(`[SSE] Nenhuma conexão ativa para o usuário ${userId}`);
      return;
    }
    
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    const deadConnections = [];
    
    // Envia para todas as conexões do usuário
    userConnections.forEach((res, connectionId) => {
      try {
        res.write(message);
        console.log(`[SSE] Evento '${eventType}' enviado para conexão ${connectionId}`);
      } catch (error) {
        console.error(`[SSE] Erro ao enviar para ${connectionId}:`, error.message);
        deadConnections.push(connectionId);
      }
    });
    
    // Remove conexões mortas
    deadConnections.forEach(connectionId => {
      this.removeConnection(userId, connectionId);
    });
  }

  /**
   * Envia um evento para todos os usuários conectados
   * @param {string} eventType - Tipo do evento
   * @param {Object} data - Dados do evento
   */
  broadcast(eventType, data) {
    console.log(`[SSE] Broadcasting evento '${eventType}' para todos os usuários`);
    
    this.connections.forEach((userConnections, userId) => {
      this.sendToUser(userId, eventType, data);
    });
  }

  /**
   * Envia um heartbeat para manter a conexão viva
   * @param {string} userId - ID do usuário
   * @param {string} connectionId - ID da conexão
   * @param {Response} res - Objeto response
   */
  sendHeartbeat(userId, connectionId, res) {
    try {
      res.write(':heartbeat\n\n');
    } catch (error) {
      console.error(`[SSE] Erro ao enviar heartbeat para ${connectionId}:`, error.message);
      this.removeConnection(userId, connectionId);
    }
  }

  /**
   * Retorna estatísticas das conexões
   * @returns {Object} - Estatísticas
   */
  getStats() {
    let totalConnections = 0;
    const userStats = {};
    
    this.connections.forEach((userConnections, userId) => {
      const count = userConnections.size;
      totalConnections += count;
      userStats[userId] = count;
    });
    
    return {
      totalUsers: this.connections.size,
      totalConnections,
      userStats
    };
  }
}

// Exporta uma instância única (singleton)
const eventService = new EventService();

module.exports = eventService;