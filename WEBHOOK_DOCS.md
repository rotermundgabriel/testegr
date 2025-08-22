# 📘 Documentação do Webhook - Mercado Pago

## 🎯 Visão Geral

O webhook implementado permite que sua aplicação receba notificações em tempo real do Mercado Pago quando ocorrem eventos de pagamento. Quando um pagamento é processado através do Payment Brick, o dashboard é atualizado automaticamente sem necessidade de recarregar a página.

## 🚀 Funcionalidades Implementadas

### 1. **Webhook Endpoint**
- **URL**: `/api/webhooks/mercadopago`
- **Método**: POST
- **Autenticação**: Não requerida (endpoint público para o Mercado Pago)

### 2. **Server-Sent Events (SSE)**
- Notificações em tempo real para o dashboard
- Reconexão automática em caso de perda de conexão
- Heartbeat para manter conexão ativa

### 3. **Processamento de Notificações**
- Validação de estrutura da notificação
- Verificação de status no Mercado Pago
- Atualização do banco de dados
- Envio de eventos SSE para o usuário

## 📋 Como Funciona

### Fluxo do Webhook:

1. **Cliente faz pagamento** → Payment Brick processa o pagamento
2. **Mercado Pago envia notificação** → POST para `/api/webhooks/mercadopago`
3. **Webhook processa notificação**:
   - Valida estrutura
   - Busca link de pagamento no banco
   - Consulta status no MP
   - Atualiza banco de dados
   - Salva notificação para auditoria
4. **Envia evento SSE** → Dashboard recebe atualização
5. **Dashboard atualiza automaticamente** → Sem recarregar a página

## 🔧 Configuração

### 1. Variáveis de Ambiente

Certifique-se de que o arquivo `.env` contenha:

```env
# URL da aplicação (importante para o webhook)
APP_URL=https://seu-dominio.com

# Credenciais do Mercado Pago
MP_ACCESS_TOKEN=seu_access_token_aqui
```

### 2. Configurar URL do Webhook no Mercado Pago

1. Acesse o [Painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
2. Vá em **Suas integrações** → **Notificações Webhooks**
3. Configure a URL: `https://seu-dominio.com/api/webhooks/mercadopago`
4. Selecione os eventos:
   - ✅ Pagamentos
   - ✅ Merchant Orders (opcional)

## 🧪 Testando o Webhook

### Método 1: Script de Teste (Recomendado)

```bash
# Instalar dependências
npm install

# Executar teste interativo
npm run test-webhook

# Ou diretamente
node test-webhook.js
```

O script oferece opções para:
- Enviar notificações de pagamento aprovado/pendente/rejeitado
- Simular fluxo completo de pagamento
- Enviar notificações customizadas

### Método 2: Teste Manual com cURL

```bash
# Notificação de pagamento aprovado
curl -X POST http://localhost:3000/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -d '{
    "id": "12345",
    "type": "payment",
    "data": {
      "id": "payment_id_aqui"
    }
  }'
```

### Método 3: Teste com Mercado Pago Sandbox

1. Use credenciais de teste (sandbox)
2. Crie um link de pagamento de teste
3. Faça um pagamento com cartão de teste
4. Observe o webhook sendo acionado

## 📊 Monitoramento

### Logs do Webhook

O webhook gera logs detalhados:

```
[Webhook] ========== NOVA NOTIFICAÇÃO RECEBIDA ==========
[Webhook] Tipo: payment ID: 123456789
[Webhook] Link encontrado: { id: 'abc-123', description: 'Produto X' }
[Webhook] Status do pagamento no MP: { status: 'approved' }
[Webhook] ✅ PAGAMENTO APROVADO! Link: abc-123
```

### Estatísticas SSE

Endpoint para verificar conexões ativas:

```bash
GET /api/events/stats

# Resposta:
{
  "totalUsers": 2,
  "totalConnections": 3,
  "userStats": {
    "1": 2,
    "2": 1
  }
}
```

## 🎨 Notificações no Dashboard

### Tipos de Notificação:

1. **Conexão SSE**
   - `✅ Conectado ao servidor` (sucesso, 3s)

2. **Atualização de Pagamento**
   - `✅ Link "Produto X" - Status: Pago` (sucesso)
   - `⏳ Link "Produto Y" - Status: Pendente` (info)
   - `❌ Link "Produto Z" - Status: Cancelado` (info)

3. **Pagamento Completo**
   - `🎉 Pagamento Aprovado! R$ 100,00 - Produto X` (sucesso, 10s)
   - Toca som de notificação
   - Atualiza tabela e estatísticas

## 🔍 Troubleshooting

### Webhook não está recebendo notificações

1. **Verifique a URL configurada no MP**
   ```bash
   echo $APP_URL/api/webhooks/mercadopago
   ```

2. **Teste conectividade**
   ```bash
   curl -X POST sua-url/api/webhooks/mercadopago \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

3. **Verifique logs do servidor**
   ```bash
   npm run dev
   # Observe os logs [Webhook]
   ```

### Dashboard não atualiza em tempo real

1. **Verifique conexão SSE no console do navegador**
   ```javascript
   // Deve aparecer:
   [SSE] Conectando ao servidor de eventos...
   [SSE] Conectado: {message: "Conectado ao servidor", ...}
   ```

2. **Verifique token de autenticação**
   ```javascript
   localStorage.getItem('token') // Deve retornar o token
   ```

3. **Teste manualmente o SSE**
   ```bash
   curl -N -H "Authorization: Bearer SEU_TOKEN" \
     http://localhost:3000/api/events
   ```

### Erro de CORS

Adicione no nginx ou servidor proxy:

```nginx
location /api/events {
    proxy_set_header X-Accel-Buffering no;
    proxy_set_header Cache-Control no-cache;
    proxy_pass http://localhost:3000;
}
```

## 📝 Estrutura do Banco de Dados

### Tabela: payment_notifications

```sql
CREATE TABLE payment_notifications (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL,
    mp_notification_id TEXT,
    status TEXT,
    data TEXT, -- JSON com dados completos
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## 🔐 Segurança

### Recomendações:

1. **Validação de IP** (opcional)
   - Aceitar apenas IPs do Mercado Pago

2. **Assinatura HMAC** (opcional)
   - Validar assinatura das notificações

3. **Rate Limiting**
   - Limitar requisições por IP

4. **Timeout de Processamento**
   - Processar async para responder rápido ao MP

## 📚 Referências

- [Documentação Webhooks MP](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Payment Brick](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/introduction)
- [Server-Sent Events MDN](https://developer.mozilla.org/pt-BR/docs/Web/API/Server-sent_events)

## 💡 Dicas

1. **Sempre retorne 200 OK** para o Mercado Pago, mesmo em caso de erro
2. **Processe notificações de forma idempotente** - podem ser reenviadas
3. **Use logs detalhados** para debug
4. **Implemente retry logic** para consultas ao MP
5. **Mantenha histórico de notificações** para auditoria

---

## 🆘 Suporte

Em caso de dúvidas:
1. Verifique os logs do servidor
2. Use o script de teste para simular notificações
3. Consulte a documentação do Mercado Pago
4. Verifique o status do serviço do MP