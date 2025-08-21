// create-link.js - Gerenciamento de criação de links de pagamento

// Estado global
let currentLink = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    applyMasks();
});

// Inicializar formulário
function initializeForm() {
    const form = document.getElementById('createLinkForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (validateForm()) {
            await createPaymentLink();
        }
    });

    // Validação em tempo real
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearError(input.id));
    });
}

// Aplicar máscaras aos campos
function applyMasks() {
    // Máscara de CPF
    const cpfInput = document.getElementById('clientCpf');
    cpfInput.addEventListener('input', (e) => {
        e.target.value = formatCPF(e.target.value);
    });

    // Máscara de moeda
    const amountInput = document.getElementById('amount');
    amountInput.addEventListener('input', (e) => {
        e.target.value = formatCurrency(e.target.value);
    });

    // Prevenir caracteres não numéricos no valor
    amountInput.addEventListener('keypress', (e) => {
        const char = String.fromCharCode(e.keyCode || e.which);
        if (!/[\d,]/.test(char) && e.keyCode !== 8 && e.keyCode !== 46) {
            e.preventDefault();
        }
    });
}

// Validar formulário completo
function validateForm() {
    const fields = ['title', 'amount', 'clientName', 'clientEmail', 'clientCpf'];
    let isValid = true;

    fields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (!validateField(input)) {
            isValid = false;
        }
    });

    return isValid;
}

// Validar campo individual
function validateField(input) {
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';

    switch(input.id) {
        case 'title':
            if (value.length < 3) {
                errorMessage = 'O título deve ter pelo menos 3 caracteres';
                isValid = false;
            }
            break;
            
        case 'amount':
            const numValue = parseFloat(value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
            if (isNaN(numValue) || numValue < 0.01) {
                errorMessage = 'Valor mínimo: R$ 0,01';
                isValid = false;
            } else if (numValue > 10000) {
                errorMessage = 'Valor máximo: R$ 10.000,00';
                isValid = false;
            }
            break;
            
        case 'clientName':
            if (value.length < 3) {
                errorMessage = 'Nome deve ter pelo menos 3 caracteres';
                isValid = false;
            }
            break;
            
        case 'clientEmail':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                errorMessage = 'Email inválido';
                isValid = false;
            }
            break;
            
        case 'clientCpf':
            const cpf = cleanCPF(value);
            if (cpf.length !== 11) {
                errorMessage = 'CPF deve ter 11 dígitos';
                isValid = false;
            } else if (!validateCPF(cpf)) {
                errorMessage = 'CPF inválido';
                isValid = false;
            }
            break;
    }

    if (!isValid) {
        showError(input.id, errorMessage);
        input.classList.add('error');
    } else {
        clearError(input.id);
        input.classList.remove('error');
    }

    return isValid;
}

// Validação básica de CPF
function validateCPF(cpf) {
    // Remove caracteres não numéricos
    cpf = cpf.replace(/[^\d]/g, '');
    
    // Verifica se tem 11 dígitos
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Validação dos dígitos verificadores
    let sum = 0;
    let remainder;
    
    // Primeiro dígito
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i-1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    // Segundo dígito
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i-1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

// Mostrar erro
function showError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Limpar erro
function clearError(fieldId) {
    const errorElement = document.getElementById(fieldId + 'Error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    
    const input = document.getElementById(fieldId);
    if (input) {
        input.classList.remove('error');
    }
}

// Criar link de pagamento
async function createPaymentLink() {
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    // Mostrar loading
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    submitBtn.disabled = true;

    try {
        // Pegar valores do formulário
        const formData = {
            title: document.getElementById('title').value.trim(),
            amount: parseFloat(
                document.getElementById('amount').value
                    .replace('R$', '')
                    .replace(/\./g, '')
                    .replace(',', '.')
                    .trim()
            ),
            payer: {
                first_name: document.getElementById('clientName').value.trim().split(' ')[0],
                last_name: document.getElementById('clientName').value.trim().split(' ').slice(1).join(' ') || '',
                email: document.getElementById('clientEmail').value.trim(),
                identification: {
                    type: 'CPF',
                    number: cleanCPF(document.getElementById('clientCpf').value)
                }
            }
        };

        // Fazer requisição
        const response = await fetch('/api/payment-links/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('userToken')}`
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao criar link');
        }

        const data = await response.json();
        
        // Salvar link atual
        currentLink = data;
        
        // Mostrar sucesso
        showSuccessCard(data);
        
        // Mostrar mensagem de sucesso
        showMessage('Link criado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro:', error);
        showMessage(error.message || 'Erro ao criar link. Tente novamente.', 'error');
    } finally {
        // Restaurar botão
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// Mostrar card de sucesso
function showSuccessCard(linkData) {
    // Esconder formulário
    document.getElementById('formCard').style.display = 'none';
    
    // Preencher dados do link
    const successCard = document.getElementById('successCard');
    
    // URL do link
    const linkUrl = `${window.location.origin}/pay/${linkData.id}`;
    document.getElementById('generatedLink').value = linkUrl;
    
    // Detalhes
    document.getElementById('detailAmount').textContent = formatCurrency(linkData.amount.toString());
    document.getElementById('detailClient').textContent = document.getElementById('clientName').value;
    document.getElementById('detailTitle').textContent = linkData.title;
    
    // Mostrar card
    successCard.style.display = 'block';
    
    // Scroll suave para o card
    successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Copiar link
async function copyLink() {
    const linkInput = document.getElementById('generatedLink');
    const linkUrl = linkInput.value;
    
    try {
        await copyToClipboard(linkUrl);
        
        // Feedback visual
        const copyBtn = document.querySelector('.btn-copy');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Copiado!';
        copyBtn.classList.add('copied');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('copied');
        }, 2000);
        
        showMessage('Link copiado para a área de transferência!', 'success');
    } catch (error) {
        showMessage('Erro ao copiar link', 'error');
    }
}

// Gerar QR Code
function generateQRCode() {
    const modal = document.getElementById('qrModal');
    const container = document.getElementById('qrCodeContainer');
    const linkUrl = document.getElementById('generatedLink').value;
    
    // Limpar container
    container.innerHTML = '';
    
    // Gerar QR Code
    QRCode.toCanvas(linkUrl, {
        width: 256,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }, (error, canvas) => {
        if (error) {
            console.error(error);
            showMessage('Erro ao gerar QR Code', 'error');
            return;
        }
        
        container.appendChild(canvas);
        modal.style.display = 'flex';
    });
}

// Fechar modal do QR Code
function closeQRModal() {
    document.getElementById('qrModal').style.display = 'none';
}

// Criar novo link
function createNewLink() {
    // Limpar formulário
    document.getElementById('createLinkForm').reset();
    
    // Limpar erros
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => {
        error.textContent = '';
        error.style.display = 'none';
    });
    
    // Remover classes de erro
    const inputs = document.querySelectorAll('.error');
    inputs.forEach(input => input.classList.remove('error'));
    
    // Esconder card de sucesso
    document.getElementById('successCard').style.display = 'none';
    
    // Mostrar formulário
    document.getElementById('formCard').style.display = 'block';
    
    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Focar no primeiro campo
    document.getElementById('title').focus();
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('qrModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}
