let currentUser = localStorage.getItem('eduCurrentUser') || '';
let onAuthCallback = null;

export function getCurrentUser() { return currentUser; }
export function setAuthCallback(fn) { onAuthCallback = fn; }

function getUsers() {
    return JSON.parse(localStorage.getItem('eduUsers')) || {};
}
function saveUsers(users) {
    localStorage.setItem('eduUsers', JSON.stringify(users));
}

export function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { showAuthError('Enter username and password.'); return; }
    const users = getUsers();
    if (!users[username]) { showAuthError('User not found. Sign up first.'); return; }
    if (users[username] !== password) { showAuthError('Wrong password.'); return; }
    currentUser = username;
    localStorage.setItem('eduCurrentUser', currentUser);
    document.getElementById('authError').style.display = 'none';
    if (onAuthCallback) onAuthCallback();
}

export function handleSignup() {
    const username = document.getElementById('signupUsername').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    if (!username || !password) { showAuthError('Enter username and password.'); return; }
    if (username.length < 3) { showAuthError('Username must be at least 3 characters.'); return; }
    if (password.length < 4) { showAuthError('Password must be at least 4 characters.'); return; }
    const users = getUsers();
    if (users[username]) { showAuthError('Username already taken. Choose another.'); return; }
    users[username] = password;
    saveUsers(users);
    currentUser = username;
    localStorage.setItem('eduCurrentUser', currentUser);
    document.getElementById('authError').style.display = 'none';
    showAuthError('Account created! Logging in...', '#10B981');
    setTimeout(() => { if (onAuthCallback) onAuthCallback(); }, 300);
}

export function handleLogout() {
    currentUser = '';
    localStorage.removeItem('eduCurrentUser');
    localStorage.removeItem('eduDB_v4_final');
    location.reload();
}

function showAuthError(msg, color) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.style.color = color || 'var(--error)';
    el.style.display = 'block';
}

export function switchAuthTab(tab) {
    document.getElementById('authLoginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('authSignupForm').style.display = tab === 'login' ? 'none' : 'block';
    document.getElementById('authLoginTab').classList.toggle('active', tab === 'login');
    document.getElementById('authSignupTab').classList.toggle('active', tab === 'signup');
    document.getElementById('authError').style.display = 'none';
}

export function isLoggedIn() {
    return !!currentUser;
}
