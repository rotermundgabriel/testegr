// API Configuration
const API_BASE_URL = '/api/auth';

// Authentication Functions
async function handleLogin(email, password) {
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('errorMessage');
    
    try {
        // Show loading state
        setLoadingState(submitBtn, true);
        clearError(errorDiv);
        
        // Make API request
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Save to localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            console.log('Login successful:', data.user.email);
            
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        } else {
            // Show error message
            showError(errorDiv, data.message || 'E-mail ou senha incorretos');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(errorDiv, 'Erro ao fazer login. Tente novamente.');
    } finally {
        setLoadingState(submitBtn, false);
    }
}

async function handleRegister(name, email, password, access_token, public_key) {
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('errorMessage');
    
    try {
        // Show loading state
        setLoadingState(submitBtn, true);
        clearError(errorDiv);
        
        // Validate password length
        if (password.length < 6) {
            showError(errorDiv, 'A senha deve ter pelo menos 6 caracteres');
            setLoadingState(submitBtn, false);
            return;
        }
        
        // Validate Mercado Pago credentials format
        if (!access_token || access_token.length < 20) {
            showError(errorDiv, 'Access Token inválido. Verifique suas credenciais do Mercado Pago');
            setLoadingState(submitBtn, false);
            return;
        }
        
        if (!public_key || public_key.length < 10) {
            showError(errorDiv, 'Public Key inválida. Verifique suas credenciais do Mercado Pago');
            setLoadingState(submitBtn, false);
            return;
        }
        
        // Make API request
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                name, 
                email, 
                password,
                access_token,
                public_key
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Save to localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            console.log('Registration successful:', data.user.email);
            
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        } else {
            // Show error message
            let errorMessage = 'Erro ao criar conta';
            
            if (data.message) {
                if (data.message.includes('already exists')) {
                    errorMessage = 'Este e-mail já está cadastrado';
                } else if (data.message.includes('Invalid email')) {
                    errorMessage = 'E-mail inválido';
                } else if (data.message.includes('required')) {
                    errorMessage = 'Preencha todos os campos obrigatórios';
                } else if (data.message.includes('Invalid Mercado Pago')) {
                    errorMessage = 'Credenciais do Mercado Pago inválidas';
                } else {
                    errorMessage = data.message;
                }
            }
            
            showError(errorDiv, errorMessage);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError(errorDiv, 'Erro ao criar conta. Tente novamente.');
    } finally {
        setLoadingState(submitBtn, false);
    }
}

function checkAuth(requireAuth = true) {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (requireAuth && (!token || !user)) {
        // Not authenticated, redirect to login
        console.log('No authentication found, redirecting to login');
        window.location.href = '/login.html';
        return false;
    } else if (!requireAuth && token && user) {
        // Already authenticated, redirect to dashboard
        console.log('Already authenticated, redirecting to dashboard');
        window.location.href = '/dashboard.html';
        return true;
    }
    
    return !!token;
}

function logout() {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    console.log('Logged out successfully');
    
    // Redirect to login
    window.location.href = '/login.html';
}

// Helper Functions
function setLoadingState(button, isLoading) {
    if (!button) return;
    
    const textSpan = button.querySelector('.btn-text');
    const loadingSpan = button.querySelector('.btn-loading');
    
    if (isLoading) {
        button.disabled = true;
        if (textSpan) textSpan.style.display = 'none';
        if (loadingSpan) loadingSpan.style.display = 'inline-block';
    } else {
        button.disabled = false;
        if (textSpan) textSpan.style.display = 'inline-block';
        if (loadingSpan) loadingSpan.style.display = 'none';
    }
}

function showError(errorDiv, message) {
    if (!errorDiv) return;
    
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        clearError(errorDiv);
    }, 5000);
}

function clearError(errorDiv) {
    if (!errorDiv) return;
    
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
    errorDiv.style.display = 'none';
}

// Get user data helper
function getUserData() {
    try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

// Get auth token helper
function getAuthToken() {
    return localStorage.getItem('token');
}

// Make authenticated API request helper
async function makeAuthenticatedRequest(url, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
        throw new Error('No authentication token found');
    }
    
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    // Check if token is invalid
    if (response.status === 401) {
        console.log('Token invalid, logging out');
        logout();
        throw new Error('Authentication failed');
    }
    
    return response;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleLogin,
        handleRegister,
        checkAuth,
        logout,
        getUserData,
        getAuthToken,
        makeAuthenticatedRequest
    };
}
