// ========================================
// BOT WHATSAPP COM APRENDIZADO SIMPLES
// ========================================

// Importa bibliotecas
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

// Função de delay
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ========================================
// ARMAZENAMENTO DE CONHECIMENTO
// ========================================
const KNOWLEDGE_FILE = './knowledge.json';
let conhecimento = {};

// Carrega conhecimento existente
try {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
        conhecimento = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE));
        console.log('📚 Conhecimento carregado.');
    }
} catch {
    console.log('⚠️ Não foi possível carregar o arquivo de conhecimento. Criando novo.');
    conhecimento = {};
}

// Salva conhecimento
function saveKnowledge() {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(conhecimento, null, 2));
}

// Normaliza texto
function normalize(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ========================================
// CRIAÇÃO DO CLIENT
// ========================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 300000
    }
});

// Eventos básicos
client.on('ready', () => console.log('✅ Bot pronto!'));
client.on('qr', qr => console.log('📱 QR Code:', qr));
client.on('auth_failure', msg => console.error('❌ Falha na autenticação:', msg));
client.on('disconnected', reason => console.log('⚠️ Cliente desconectado:', reason));

// ========================================
// BLOQUEIO TEMPORÁRIO QUANDO VOCÊ ESTÁ DIGITANDO
// ========================================
const blockedWhileTyping = new Set();

client.on('typing', async (typing) => {
    const chat = await typing.getChat();
    if (typing.fromMe) {
        blockedWhileTyping.add(chat.id._serialized);
        setTimeout(() => blockedWhileTyping.delete(chat.id._serialized), 10000);
    }
});

// ========================================
// LISTENER PRINCIPAL DE MENSAGENS
// ========================================
client.on('message', async msg => {
    try {
        const chat = await msg.getChat();

        // Ignora grupos e áudios
        if (chat.isGroup) return;
        if (msg.type === 'audio' || msg.type === 'ptt') return;

        // Ignora contatos bloqueados temporariamente
        if (blockedWhileTyping.has(msg.from)) return;

        const textoOriginal = (msg.body || '').toString();
        const texto = normalize(textoOriginal);
        console.log(`📨 Mensagem recebida de ${chat.name || msg.from}: "${textoOriginal}"`);

        await sleep(2000);

        // ========================================
        // RESPOSTA BASEADA EM CONHECIMENTO
        // ========================================
        if (conhecimento[texto]) {
            await msg.reply(`🤖 ${conhecimento[texto]}`);
        } else {
            // Pergunta usuário e aprende
            await msg.reply('❓ Não sei a resposta. Me ensine:');
            const filter = m => m.from === msg.from;
            const collector = chat.createMessageCollector({ filter, max: 1, time: 30000 });

            collector.on('collect', async m => {
                const resposta = m.body;
                conhecimento[texto] = resposta;
                saveKnowledge();
                await msg.reply('✅ Entendido, vou lembrar dessa resposta.');
                console.log(`💾 Aprendido: "${texto}" → "${resposta}"`);
            });

            collector.on('end', collected => {
                if (collected.size === 0) msg.reply('⚠️ Você não respondeu a tempo. Não aprendi nada.');
            });
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// ========================================
// INICIALIZAÇÃO DO NAVEGADOR E DO BOT
// ========================================
(async () => {
    console.log('⏳ Inicializando o Chrome...');
    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 300000
        });
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
        console.log('✅ Chrome inicializado com sucesso!');
    } catch (err) {
        console.error('⚠️ Erro ao inicializar o Chrome:', err.message);
    }

    console.log('🔄 Inicializando o WhatsApp...');
    client.initialize();
})();
