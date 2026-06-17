require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Dashboard connecté à MongoDB'));

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcome: { enabled: Boolean, channelId: String, message: String, couleur: String },
    goodbye: { enabled: Boolean, channelId: String, message: String, couleur: String },
    moderation: { logChannelId: String },
    autorole: { enabled: Boolean, roles: [String] },
    tickets: { titre: String, description: String, categories: mongoose.Schema.Types.Mixed, askReason: Boolean, askCloseReason: Boolean },
    tempvoice: { enabled: Boolean, createChannelId: String, categoryId: String },
    stats: { enabled: Boolean, categoryId: String, channels: mongoose.Schema.Types.Mixed }
}, { strict: false });

const Config = mongoose.models.Config || mongoose.model('Config', configSchema);

const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Sert les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../')));

// Route login — redirige vers Discord
app.get('/auth/login', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds email'
    });
    res.redirect('https://discord.com/oauth2/authorize?' + params.toString());
});

// Route callback — Discord renvoie le code ici
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');

    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token } = tokenRes.data;

        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: 'Bearer ' + access_token }
        });

        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: 'Bearer ' + access_token }
        });

        req.session.user = userRes.data;
        req.session.guilds = guildsRes.data;
        req.session.access_token = access_token;

        res.redirect('http://localhost:3000/dashboard.html');
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});

// Route pour récupérer l'utilisateur connecté
app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    res.json({ user: req.session.user, guilds: req.session.guilds });
});

// Route pour récupérer les serveurs
app.get('/api/guilds', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });

    const botGuilds = require('./botGuilds.js');

    if (!botGuilds.isReady()) {
        return res.status(503).json({ error: 'Bot pas encore prêt, réessaie dans quelques secondes' });
    }

    const adminGuilds = req.session.guilds.filter(g => (g.permissions & 0x8) === 0x8);

    const guilds = adminGuilds.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? 'https://cdn.discordapp.com/icons/' + g.id + '/' + g.icon + '.png' : null,
        botPresent: botGuilds.getGuilds().includes(g.id)
    }));

    res.json(guilds);
});

// Route logout
app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('http://localhost:3000/');
});

// Pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard.html'));
});

app.get('/api/guild/:guildId/channels', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });

    const botGuilds = require('./botGuilds.js');
    const guild = botGuilds.getClient().guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const channels = guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type }));
    const roles = guild.roles.cache.map(r => ({ id: r.id, name: r.name }));

    res.json({ channels, roles });
});

// Récupère la config d'un serveur
app.get('/api/guild/:guildId/config', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    let config = await Config.findOne({ guildId: req.params.guildId });
    if (!config) config = new Config({ guildId: req.params.guildId });
    res.json(config);
});

// Sauvegarde la config d'un module
app.post('/api/guild/:guildId/config', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    await Config.findOneAndUpdate(
        { guildId: req.params.guildId },
        { $set: req.body },
        { upsert: true, returnDocument: 'after' }
    );
    res.json({ success: true });
});

app.listen(process.env.PORT, () => {
    console.log('Backend OrionBot lancé sur le port ' + process.env.PORT);
});