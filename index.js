const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

// ===============================
// CONFIGURAÇÃO
// ===============================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1553529733441130616";

// ===============================
// VERIFICAÇÃO DO TOKEN
// ===============================

if (!TOKEN) {
    console.error("❌ A variável TOKEN não foi configurada no Render.");
    process.exit(1);
}

// ===============================
// CLIENTE DO DISCORD
// ===============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// ===============================
// COMANDOS
// ===============================

const commands = [
    new SlashCommandBuilder()
        .setName("gerartemplate")
        .setDescription("Cria automaticamente a estrutura do servidor.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator.toString()
        )
].map(command => command.toJSON());

// ===============================
// REGISTRO DO COMANDO
// ===============================

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    try {
        console.log("🔄 Registrando comandos...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log("✅ Comando /gerartemplate registrado.");
    } catch (error) {
        console.error("❌ Erro ao registrar comandos:", error);
    }
}

// ===============================
// BOT ONLINE
// ===============================

client.once("ready", async () => {
    console.log(`✅ Bot online como ${client.user.tag}`);

    await registerCommands();
});

// ===============================
// COMANDO /GERARTEMPLATE
// ===============================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (interaction.commandName !== "gerartemplate") {
        return;
    }

    if (!interaction.guild) {
        return interaction.reply({
            content: "❌ Este comando só pode ser usado dentro de um servidor.",
            ephemeral: true
        });
    }

    if (
        !interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return interaction.reply({
            content: "❌ Você precisa ser Administrador para usar este comando.",
            ephemeral: true
        });
    }

    await interaction.reply({
        content: "⚙️ Criando a estrutura do servidor...",
        ephemeral: true
    });

    try {

        const guild = interaction.guild;

        // ===============================
        // CARGOS
        // ===============================

        console.log("🔄 Criando cargos...");

        const cargoDono = await guild.roles.create({
            name: "👑 • Fundador",
            color: 0xff0000,
            permissions: [
                PermissionFlagsBits.Administrator
            ],
            reason: "Criação automática do template"
        });

        const cargoAdmin = await guild.roles.create({
            name: "🛡️ • Administrador",
            color: 0x9b59b6,
            permissions: [
                PermissionFlagsBits.ManageGuild,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.ManageChannels
            ],
            reason: "Criação automática do template"
        });

        const cargoMod = await guild.roles.create({
            name: "🔨 • Moderador",
            color: 0x3498db,
            permissions: [
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.KickMembers
            ],
            reason: "Criação automática do template"
        });

        const cargoMembro = await guild.roles.create({
            name: "👤 • Membro",
            color: 0x2ecc71,
            reason: "Criação automática do template"
        });

        // ===============================
        // CATEGORIA INFORMAÇÕES
        // ===============================

        console.log("🔄 Criando categoria de informações...");

        const catInfo = await guild.channels.create({
            name: "📌 ┃ INFORMAÇÕES",
            type: ChannelType.GuildCategory
        });

        const chanRegras = await guild.channels.create({
            name: "📜-regras",
            type: ChannelType.GuildText,
            parent: catInfo.id
        });

        const chanAnuncios = await guild.channels.create({
            name: "📢-anúncios",
            type: ChannelType.GuildText,
            parent: catInfo.id
        });

        await chanRegras.permissionOverwrites.edit(
            guild.roles.everyone,
            {
                SendMessages: false
            }
        );

        await chanAnuncios.permissionOverwrites.edit(
            guild.roles.everyone,
            {
                SendMessages: false
            }
        );

        // ===============================
        // CATEGORIA COMUNIDADE
        // ===============================

        console.log("🔄 Criando categoria da comunidade...");

        const catChat = await guild.channels.create({
            name: "💬 ┃ COMUNIDADE",
            type: ChannelType.GuildCategory
        });

        await guild.channels.create({
            name: "chat-geral",
            type: ChannelType.GuildText,
            parent: catChat.id
        });

        await guild.channels.create({
            name: "bot-comandos",
            type: ChannelType.GuildText,
            parent: catChat.id
        });

        // ===============================
        // CATEGORIA DE VOZ
        // ===============================

        console.log("🔄 Criando canais de voz...");

        const catVoz = await guild.channels.create({
            name: "🔊 ┃ CANAIS DE VOZ",
            type: ChannelType.GuildCategory
        });

        await guild.channels.create({
            name: "🔊 • Lounge Principal",
            type: ChannelType.GuildVoice,
            parent: catVoz.id
        });

        await guild.channels.create({
            name: "🔊 • Squad 01",
            type: ChannelType.GuildVoice,
            parent: catVoz.id
        });

        // ===============================
        // CATEGORIA STAFF
        // ===============================

        console.log("🔄 Criando área da staff...");

        const catStaff = await guild.channels.create({
            name: "🔒 ┃ ÁREA DA STAFF",
            type: ChannelType.GuildCategory
        });

        await catStaff.permissionOverwrites.edit(
            guild.roles.everyone,
            {
                ViewChannel: false
            }
        );

        await catStaff.permissionOverwrites.edit(
            cargoMod,
            {
                ViewChannel: true,
                SendMessages: true
            }
        );

        await catStaff.permissionOverwrites.edit(
            cargoAdmin,
            {
                ViewChannel: true,
                SendMessages: true
            }
        );

        await guild.channels.create({
            name: "💬-chat-staff",
            type: ChannelType.GuildText,
            parent: catStaff.id
        });

        // ===============================
        // FINALIZAÇÃO
        // ===============================

        console.log("✅ Template criado com sucesso!");

        await interaction.editReply({
            content:
                "✅ **Servidor configurado com sucesso!**\n\n" +
                "👑 Cargos criados\n" +
                "📁 Categorias criadas\n" +
                "💬 Canais de texto criados\n" +
                "🔊 Canais de voz criados\n" +
                "🔒 Área da staff configurada"
        });

    } catch (error) {

        console.error("❌ ERRO AO CRIAR TEMPLATE:");
        console.error(error);

        await interaction.editReply({
            content:
                "❌ **Ocorreu um erro durante a criação do template.**\n" +
                "Veja os logs do Render para identificar o problema."
        });
    }
});

// ===============================
// LOGIN
// ===============================

client.login(TOKEN);
