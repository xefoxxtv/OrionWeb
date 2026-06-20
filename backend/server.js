require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Dashboard connecté à MongoDB'));

const { connectDB, getConfig, saveConfig } = require('./database.js');
connectDB();

const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: ['https://orionbot-backend-hxyh.onrender.com', 'http://localhost:3000'], credentials: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'none'
    }
}));

// Sert les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../')));

// Route login
app.get('/auth/login', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds email'
    });
    res.redirect('https://discord.com/oauth2/authorize?' + params.toString());
});

// Route callback
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
        console.log('Session sauvegardée pour:', req.session.user.username);

        await req.session.save();

        res.redirect('https://orionbot-backend-hxyh.onrender.com/dashboard.html');
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});

// Route me
app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    res.json({ user: req.session.user, guilds: req.session.guilds });
});

app.get('/api/me', (req, res) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session user:', req.session.user ? req.session.user.username : 'non connecté');
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    res.json({ user: req.session.user, guilds: req.session.guilds });
});

// Route guilds
app.get('/api/guilds', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });

    const adminGuilds = req.session.guilds.filter(g => (g.permissions & 0x8) === 0x8);

    const guildsWithBot = await Promise.all(adminGuilds.map(async (g) => {
        try {
            await axios.get('https://discord.com/api/guilds/' + g.id, {
                headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN }
            });
            return { ...g, botPresent: true };
        } catch {
            return { ...g, botPresent: false };
        }
    }));

    const guilds = guildsWithBot.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? 'https://cdn.discordapp.com/icons/' + g.id + '/' + g.icon + '.png' : null,
        botPresent: g.botPresent
    }));

    res.json(guilds);
});

// Route logout
app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('https://orionbot-backend-hxyh.onrender.com/');
});

// Pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard.html'));
});

app.get('/server.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../server.html'));
});

// Channels et rôles
app.get('/api/guild/:guildId/channels', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });

    try {
        const [channelsRes, rolesRes] = await Promise.all([
            axios.get('https://discord.com/api/guilds/' + req.params.guildId + '/channels', {
                headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN }
            }),
            axios.get('https://discord.com/api/guilds/' + req.params.guildId + '/roles', {
                headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN }
            })
        ]);

        res.json({ channels: channelsRes.data, roles: rolesRes.data });
    } catch (e) {
        res.status(500).json({ error: 'Erreur API Discord' });
    }
});

// Config
app.get('/api/guild/:guildId/config', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    const config = await getConfig(req.params.guildId);
    res.json(config);
});

app.post('/api/guild/:guildId/config', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    console.log('Config reçue:', JSON.stringify(req.body));
    const result = await mongoose.connection.collection('configs').updateOne(
    { guildId },
    { $set: update },
    { upsert: true }
    );
    console.log('Update result:', JSON.stringify(result));
    try {
        const { saveConfig } = require('./database.js');
        const guildId = req.params.guildId;
        const data = req.body;
        
        // Construit l'update avec $set pour ne pas écraser les autres champs
        const update = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                for (const [subKey, subValue] of Object.entries(value)) {
                    update[key + '.' + subKey] = subValue;
                }
            } else {
                update[key] = value;
            }
        }
        
        await mongoose.connection.collection('configs').updateOne(
            { guildId },
            { $set: update },
            { upsert: true }
        );
        
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.listen(process.env.PORT, () => {
    console.log('Backend OrionBot lancé sur le port ' + process.env.PORT);
});