require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let guilds = [];
let ready = false;

client.once('ready', () => {
    guilds = client.guilds.cache.map(g => g.id);
    ready = true;
    console.log('Bot connecté pour le dashboard — ' + guilds.length + ' serveurs');
});

client.login(process.env.BOT_TOKEN);

module.exports = {
    getGuilds: () => guilds,
    isReady: () => ready,
    getClient: () => client
};