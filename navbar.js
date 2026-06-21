const ADMIN_ID = '1368991214359150754';
const BACKEND = '';

async function initNavbar() {
    let user = null;

    try {
        const res = await fetch(BACKEND + '/api/me', { credentials: 'include' });
        const data = await res.json();
        if (!data.error) user = data.user;
    } catch {}

    const isAdmin = user && user.id === ADMIN_ID;

    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    navbar.innerHTML = `
        <a href="/" class="nav-logo">
            <div class="nav-logo-img"></div>
            <span>OrionBot</span>
        </a>
        <ul class="nav-links">
            <li><a href="/#features">Fonctionnalités</a></li>
            <li><a href="/#services">Services</a></li>
            <li><a href="/#contact">Contact</a></li>
        </ul>
        <div class="nav-right">
            <a href="/dashboard.html" class="btn btn-outline">📊 Dashboard</a>
            <a href="#" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="white"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>
                Ajouter le bot
            </a>
            ${user ? `
                <div class="profile-menu">
                    <div class="profile-trigger" onclick="toggleMenu()">
                        <img class="profile-avatar" src="${user.avatar ? 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png' : 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="">
                        <span class="profile-name">${user.username}</span>
                        <span class="profile-arrow">▾</span>
                    </div>
                    <div class="profile-dropdown" id="profile-dropdown">
                        <a href="/dashboard.html" class="dropdown-item">📊 Dashboard</a>
                        ${isAdmin ? '<a href="/admin.html" class="dropdown-item admin-item">👑 Panel Admin</a>' : ''}
                        <div class="dropdown-divider"></div>
                        <a href="/auth/logout" class="dropdown-item logout-item">🚪 Déconnexion</a>
                    </div>
                </div>
            ` : `
                <a href="/auth/login" class="btn btn-outline">🔑 Connexion Discord</a>
            `}
        </div>
    `;

    // CSS du menu
    const style = document.createElement('style');
    style.textContent = `
        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-links { display: flex; align-items: center; gap: 32px; list-style: none; }
        .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .nav-links a:hover { color: var(--text); }
        .nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        .nav-logo-img { width: 38px; height: 38px; border-radius: 50%; background-image: url('/assets/logo.jpg'); background-size: cover; background-position: center; }
        .nav-logo span { font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #fff 0%, var(--purple-light) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .btn { padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border: none; }
        .btn-primary { background: linear-gradient(135deg, var(--purple) 0%, var(--purple-dark) 100%); color: white; box-shadow: 0 4px 20px rgba(168, 85, 247, 0.3); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(168, 85, 247, 0.5); }
        .btn-outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .btn-outline:hover { border-color: var(--purple); color: var(--purple-light); transform: translateY(-2px); }
        .profile-menu { position: relative; }
        .profile-trigger { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px 12px; border-radius: 10px; border: 1px solid var(--border); transition: all 0.2s; }
        .profile-trigger:hover { border-color: var(--purple); background: rgba(168, 85, 247, 0.05); }
        .profile-avatar { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--purple); }
        .profile-name { font-size: 14px; font-weight: 600; color: var(--text); }
        .profile-arrow { font-size: 12px; color: var(--text-muted); }
        .profile-dropdown { position: absolute; top: calc(100% + 8px); right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 8px; min-width: 180px; display: none; flex-direction: column; gap: 2px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); z-index: 999; }
        .profile-dropdown.open { display: flex; }
        .dropdown-item { padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--text-muted); text-decoration: none; transition: all 0.2s; }
        .dropdown-item:hover { background: rgba(168, 85, 247, 0.1); color: var(--text); }
        .admin-item { color: var(--purple-light) !important; }
        .admin-item:hover { background: rgba(168, 85, 247, 0.15) !important; }
        .dropdown-divider { height: 1px; background: var(--border); margin: 4px 0; }
        .logout-item:hover { background: rgba(255, 50, 50, 0.1) !important; color: #ff6b6b !important; }
    `;
    document.head.appendChild(style);
}

function toggleMenu() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.toggle('open');
}

document.addEventListener('click', (e) => {
    const menu = document.querySelector('.profile-menu');
    if (menu && !menu.contains(e.target)) {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) dropdown.classList.remove('open');
    }
});

initNavbar();