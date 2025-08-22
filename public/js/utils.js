// utils.js - Funções utilitárias compartilhadas

/**
 * Formatar valor para moeda brasileira
 * @param {string|number} value - Valor a ser formatado
 * @returns {string} Valor formatado como R$ X.XXX,XX
 */
function formatCurrency(value) {
    // Converter para string e remover caracteres não numéricos
    let cleanValue = String(value).replace(/\D/g, '');
    
    // Se vazio, retornar R$ 0,00
    if (!cleanValue) return 'R$ 0,00';
    
    // Converter para número
    let numValue = parseInt(cleanValue);
    
    // Dividir por 100 para considerar centavos
    numValue = numValue / 100;
    
    // Formatar para moeda brasileira
    return numValue.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

/**
 * Formatar CPF com máscara
 * @param {string} value - CPF sem formatação
 * @returns {string} CPF formatado XXX.XXX.XXX-XX
 */
function formatCPF(value) {
    // Remove tudo que não é dígito
    let cpf = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos
    cpf = cpf.substring(0, 11);
    
    // Aplica a máscara
    if (cpf.length > 9) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else if (cpf.length > 6) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (cpf.length > 3) {
        cpf = cpf.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    
    return cpf;
}

/**
 * Limpar CPF removendo máscara
 * @param {string} value - CPF com máscara
 * @returns {string} CPF apenas com números
 */
function cleanCPF(value) {
    return value.replace(/\D/g, '');
}

/**
 * Copiar texto para clipboard
 * @param {string} text - Texto a ser copiado
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
    // Tentar usar a API moderna primeiro
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (err) {
            console.warn('Clipboard API falhou, tentando método alternativo');
        }
    }
    
    // Método alternativo para navegadores mais antigos
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
    } catch (err) {
        throw new Error('Falha ao copiar texto');
    } finally {
        textArea.remove();
    }
}

/**
 * Mostrar mensagem toast
 * @param {string} text - Texto da mensagem
 * @param {string} type - Tipo da mensagem (success, error, warning, info)
 * @param {number} duration - Duração em ms (padrão 3000)
 */
function showMessage(text, type = 'info', duration = 3000) {
    const toast = document.getElementById('messageToast') || createToastContainer();
    
    // Definir classes e ícones baseados no tipo
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // Limpar classes anteriores
    toast.className = 'message-toast';
    
    // Adicionar nova classe
    toast.classList.add(`toast-${type}`);
    
    // Definir conteúdo
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-text">${text}</span>
    `;
    
    // Mostrar toast
    toast.classList.add('show');
    
    // Esconder após duração
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * Criar container de toast se não existir
 * @returns {HTMLElement}
 */
function createToastContainer() {
    const toast = document.createElement('div');
    toast.id = 'messageToast';
    toast.className = 'message-toast';
    document.body.appendChild(toast);
    return toast;
}

/**
 * Formatar data para exibição
 * @param {string|Date} date - Data a ser formatada
 * @returns {string} Data formatada DD/MM/YYYY HH:mm
 */
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Validar email
 * @param {string} email - Email a ser validado
 * @returns {boolean} true se válido
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Debounce função
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função com debounce
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Gerar ID único
 * @returns {string} ID único
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Verificar se está em dispositivo móvel
 * @returns {boolean} true se móvel
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Truncar texto
 * @param {string} text - Texto a ser truncado
 * @param {number} maxLength - Tamanho máximo
 * @returns {string} Texto truncado com ...
 */
function truncateText(text, maxLength = 50) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength - 3) + '...';
}

/**
 * Parse query string
 * @returns {Object} Objeto com parâmetros da URL
 */
function getQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const queries = queryString.split('&');
    
    queries.forEach(query => {
        const [key, value] = query.split('=');
        if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
    });
    
    return params;
}

/**
 * Scroll suave para elemento
 * @param {string} elementId - ID do elemento
 */
function smoothScrollTo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
}

/**
 * Carregar links do usuário
 * Busca os links de pagamento do usuário na API
 */
async function loadLinks() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Token não encontrado');
            return;
        }

        const response = await fetch('/api/payment-links', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Limitar a 5 links mais recentes para o dashboard
        const recentLinks = data.links ? data.links.slice(0, 5) : [];
        
        // Chamar a função displayLinks que já existe no dashboard.html
        if (typeof displayLinks === 'function') {
            displayLinks(recentLinks);
        }
        
        return data.links;
    } catch (error) {
        console.error('Erro ao carregar links:', error);
        
        // Mostrar mensagem de erro na tabela
        const tbody = document.getElementById('linksTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="error-cell">
                        <p>Erro ao carregar links</p>
                        <button onclick="loadLinks()" class="btn-secondary">
                            Tentar Novamente
                        </button>
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Carregar estatísticas do dashboard
 * Busca as estatísticas dos links de pagamento
 */
async function loadStats() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Token não encontrado');
            return;
        }

        const response = await fetch('/api/payment-links/stats', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const stats = await response.json();
        
        // Atualizar os elementos do dashboard com as estatísticas
        // A API retorna: total, paid, today
        if (document.getElementById('linksToday')) {
            document.getElementById('linksToday').textContent = stats.today || '0';
        }
        
        if (document.getElementById('totalLinks')) {
            document.getElementById('totalLinks').textContent = stats.total || '0';
        }
        
        if (document.getElementById('paidLinks')) {
            document.getElementById('paidLinks').textContent = stats.paid || '0';
        }
        
        return stats;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        
        // Definir valores padrão em caso de erro
        if (document.getElementById('linksToday')) {
            document.getElementById('linksToday').textContent = '0';
        }
        
        if (document.getElementById('totalLinks')) {
            document.getElementById('totalLinks').textContent = '0';
        }
        
        if (document.getElementById('paidLinks')) {
            document.getElementById('paidLinks').textContent = '0';
        }
    }
}
