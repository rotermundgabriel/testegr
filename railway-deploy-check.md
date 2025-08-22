# 🚂 Checklist para Deploy no Railway

## ✅ Status do Arquivo create-link.js

O arquivo `/public/js/create-link.js` foi **CORRIGIDO** e está pronto para deploy!

### Correções Realizadas:
- ✅ Removido código duplicado (linhas 258-564)
- ✅ Corrigida a função `createPaymentLink()` que estava cortada
- ✅ Mantidas todas as funcionalidades essenciais
- ✅ Arquivo agora tem 408 linhas (antes tinha 564 com duplicações)

## 📋 Como Testar Localmente

### 1. Teste Rápido Local:
```bash
# Se o servidor não estiver rodando
node src/app.js

# Acesse no navegador
http://localhost:3000/test-create-link-page.html
```

### 2. Teste com a Página Original:
```bash
# Acesse
http://localhost:3000/create-link.html

# Use as credenciais de teste
Email: teste@example.com
Senha: senha123
```

## 🚀 Deploy no Railway

### Passos para Deploy:

1. **Commit das alterações:**
```bash
git add public/js/create-link.js
git commit -m "Fix: Corrigido bug no create-link.js - removido código duplicado"
git push origin main
```

2. **O Railway irá automaticamente:**
   - Detectar o push
   - Fazer o build
   - Fazer o deploy

3. **Variáveis de Ambiente no Railway:**
   Certifique-se de ter configurado no Railway:
   ```
   PORT=3000
   NODE_ENV=production
   JWT_SECRET=seu_jwt_secret_aqui
   DATABASE_PATH=./database.db
   APP_URL=https://seu-app.railway.app
   ```

## 🔍 Como Verificar se Está Funcionando no Railway

### 1. Via Console do Navegador:
Acesse sua aplicação no Railway e abra o console (F12):

```javascript
// Cole isso no console para verificar se o JS está carregado
console.log('Verificando create-link.js...');
console.log('createPaymentLink existe?', typeof createPaymentLink);
console.log('validateForm existe?', typeof validateForm);
console.log('formatCurrency existe?', typeof formatCurrency);
```

### 2. Teste Manual:
1. Acesse: `https://seu-app.railway.app/create-link.html`
2. Faça login
3. Preencha o formulário
4. Clique em "GERAR LINK DE PAGAMENTO"
5. O formulário deve:
   - Validar os campos
   - Mostrar loading no botão
   - Processar a requisição
   - **NÃO deve mais fazer os dados sumirem**

## 📝 Logs para Monitorar no Railway

No dashboard do Railway, monitore os logs para:

```
✅ Logs esperados:
- "Inicializando formulário..."
- "Formulário inicializado com sucesso"
- "Formulário submetido"
- "Formulário válido, criando link..."

❌ Se houver erro com Mercado Pago:
- "Configure suas credenciais do Mercado Pago"
- Isso é normal se não tiver credenciais reais configuradas
```

## 🎯 Resultado Esperado

Após o deploy:
1. ✅ O formulário não perde mais os dados
2. ✅ A validação funciona corretamente
3. ✅ As máscaras de CPF e valor funcionam
4. ✅ O botão mostra estado de loading
5. ⚠️ Pode dar erro de credenciais do Mercado Pago (esperado sem tokens reais)

## 💡 Dica Extra

Se quiser verificar o arquivo direto no Railway após o deploy:
```
https://seu-app.railway.app/js/create-link.js
```
Isso mostrará o arquivo JavaScript diretamente no navegador.

---

**Status Final:** ✅ PRONTO PARA DEPLOY NO RAILWAY!