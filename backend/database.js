const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    verification: {
        enabled: { type: Boolean, default: false },
        type: { type: String, default: 'random' },
        timer: { type: Number, default: 300 },
        channelId: { type: String, default: '' },
        verifiedRoleId: { type: String, default: '' },
        unverifiedRoleId: { type: String, default: '' },
    },
    welcome: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: '' },
        message: { type: String, default: '🌟 Bienvenue **{user}** sur **{server}** ! Tu es le membre numéro **{count}** !' },
        mention: { type: Boolean, default: true },
        couleur: { type: String, default: '#A855F7' }
    },
    goodbye: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: '' },
        message: { type: String, default: '👋 **{username}** vient de quitter le serveur.' },
        couleur: { type: String, default: '#5B2C8D' }
    },
    moderation: {
        logChannelId: { type: String, default: '' },
    },
    tempvoice: {
        enabled: { type: Boolean, default: false },
        createChannelId: { type: String, default: '' },
        categoryId: { type: String, default: '' },
    },
    tickets: {
    // ... champs existants ...
        titre: { type: String, default: '🎫 Système de Tickets' },
        description: { type: String, default: 'Sélectionne la catégorie qui correspond à ta demande dans le menu ci-dessous.' },
        categories: { type: mongoose.Schema.Types.Mixed, default: [] },
        askReason: { type: Boolean, default: false },
        askCloseReason: { type: Boolean, default: true }
    },
    stats: {
        enabled: { type: Boolean, default: false },
        categoryId: { type: String, default: '' },
        channels: {
            membres: { type: String, default: null },
            enligne: { type: String, default: null },
            bots: { type: String, default: null },
            boosts: { type: String, default: null }
        }
    },
    planning: {
        channelId: { type: String, default: '' },
        couleur: { type: String, default: '#A855F7' },
        roleId: { type: String, default: '' }
    },
    dispo: {
        channelId: { type: String, default: '' },
        titre: { type: String, default: '📅 Disponibilités de la semaine' },
        description: { type: String, default: 'Indique ta disponibilité pour chaque jour de la semaine !' },
        couleur: { type: String, default: '#A855F7' },
        roleId: { type: String, default: '' }
    },
    roleReaction: {
        channelId: { type: String, default: '' },
    },
    autorole: {
        enabled: { type: Boolean, default: false },
        roles: { type: [String], default: [] }
    }
});

const roleReactionSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    embeds: [{
        id: { type: String, required: true },
        titre: { type: String, default: 'Rôles' },
        description: { type: String, default: '' },
        couleur: { type: String, default: '#A855F7' },
        roles: [{
            emoji: { type: String, required: true },
            label: { type: String, required: true },
            roleId: { type: String, required: true }
        }]
    }]
});

const dispoSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    titre: { type: String, default: '📅 Disponibilités de la semaine' },
    description: { type: String, default: '' },
    couleur: { type: String, default: '#A855F7' },
    presences: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const Config = mongoose.model('Config', configSchema);
const RoleReaction = mongoose.model('RoleReaction', roleReactionSchema);
const Dispo = mongoose.model('Dispo', dispoSchema);

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté à MongoDB !');
    } catch (error) {
        console.error('❌ Erreur MongoDB:', error);
    }
}

async function getConfig(guildId) {
    let config = await Config.findOne({ guildId });
    if (!config) {
        config = new Config({ guildId });
        await config.save();
    }
    return config;
}

async function saveConfig(guildId, data) {
    await Config.findOneAndUpdate({ guildId }, data, { upsert: true, new: true });
}

async function getDispo(messageId) {
    return await Dispo.findOne({ messageId });
}

async function saveDispo(messageId, guildId, data) {
    await Dispo.findOneAndUpdate(
        { messageId },
        { messageId, guildId, ...data },
        { upsert: true, new: true }
    );
}

async function getRoleReactionConfig(guildId) {
    let config = await RoleReaction.findOne({ guildId });
    if (!config) {
        config = new RoleReaction({ guildId, embeds: [] });
        await config.save();
    }
    return config;
}

async function saveRoleReactionConfig(guildId, data) {
    await RoleReaction.findOneAndUpdate(
        { guildId },
        { guildId, ...data },
        { upsert: true, new: true }
    );
}

module.exports = { connectDB, getConfig, saveConfig, getDispo, saveDispo, getRoleReactionConfig, saveRoleReactionConfig };