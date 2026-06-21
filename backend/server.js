require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Dashboard connecté à MongoDB'));

const { connectDB, getConfig } = require('./database.js');
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

app.use(express.static(path.join(__dirname, '../')));

app.get('/auth/login', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds email'
    });
    res.redirect('https://discord.com/oauth2/authorize?' + params.toString());
});

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

        await req.session.save();
        res.redirect('https://orionbot-backend-hxyh.onrender.com/dashboard.html');
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});

app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    res.json({ user: req.session.user, guilds: req.session.guilds });
});

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

app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('https://orionbot-backend-hxyh.onrender.com/');
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard.html'));
});

app.get('/server.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../server.html'));
});

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

app.get('/api/guild/:guildId/config', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    const config = await getConfig(req.params.guildId);
    res.json(config);
});

app.post('/api/guild/:guildId/config', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    try {
        const data = req.body;
        const dotNotation = {};

        function flatten(obj, prefix = '') {
            for (const [key, value] of Object.entries(obj)) {
                const newKey = prefix ? prefix + '.' + key : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flatten(value, newKey);
                } else {
                    dotNotation[newKey] = value;
                }
            }
        }

        flatten(data);
        console.log('Dot notation:', JSON.stringify(dotNotation));

        await mongoose.connection.collection('configs').updateOne(
            { guildId: req.params.guildId },
            { $set: dotNotation },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route admin
app.get('/api/admin/users', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Non connecté' });
    if (req.session.user.id !== '1368991214359150754') return res.status(403).json({ error: 'Accès refusé' });

    try {
        const sessions = await mongoose.connection.collection('sessions').find({}).toArray();
        const users = [];

        for (const session of sessions) {
            try {
                const data = JSON.parse(session.session);
                if (data.user) {
                    users.push({
                        id: data.user.id,
                        username: data.user.username,
                        avatar: data.user.avatar,
                        email: data.user.email || null,
                        guilds: data.guilds ? data.guilds.filter(g => (g.permissions & 0x8) === 0x8).length : 0,
                        lastSeen: session.expires ? new Date(session.expires - 7 * 24 * 60 * 60 * 1000) : null
                    });
                }
            } catch {}
        }

        res.json({ users });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Page admin
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin.html'));
});

app.listen(process.env.PORT, () => {
    console.log('Backend OrionBot lancé sur le port ' + process.env.PORT);
});