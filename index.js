const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1553529733441130616";

if (!TOKEN) {
    console.error("❌ A variável TOKEN não foi configurada.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/*
====================================================
 CONFIGURAÇÕES
====================================================
*/

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
const UPLOAD_TIMEOUT = 120000; // 2 minutos

/*
====================================================
 PROMPT OFICIAL
====================================================
*/

const AI_PROMPT = `
Você é um especialista em arquitetura de servidores Discord.

Sua tarefa é criar uma configuração completa de servidor Discord
seguindo EXATAMENTE o formato JSON especificado abaixo.

O usuário vai explicar como deseja o servidor.

Você deve transformar a descrição dele em uma configuração
estruturada.

REGRAS IMPORTANTES:

1. Responda SOMENTE com JSON válido.
2. Não use markdown.
3. Não coloque \`\`\`json.
4. Não invente propriedades fora do formato.
5. Crie cargos, categorias, canais e permissões de acordo
   com o pedido do usuário.
6. Mantenha nomes organizados.
7. Não crie permissões perigosas sem que o usuário peça.
8. O arquivo será enviado para um bot que criará a estrutura
   automaticamente.

FORMATO:

{
  "name": "Nome do servidor",

  "roles": [
    {
      "name": "Nome do cargo",
      "color": "#5865F2",
      "permissions": []
    }
  ],

  "categories": [
    {
      "name": "Nome da categoria",
      "channels": [
        {
          "name": "nome-do-canal",
          "type": "text",
          "topic": "Descrição opcional",
          "readOnly": false,
          "permissions": []
        },
        {
          "name": "Nome da sala",
          "type": "voice",
          "permissions": []
        }
      ]
    }
  ]
}

TIPOS DE CANAL:

"text"
"voice"

PERMISSÕES DE CARGO ACEITAS:

Administrator
ManageGuild
ManageChannels
ManageMessages
KickMembers
BanMembers
ModerateMembers
MentionEveryone
ViewChannel
SendMessages
Connect
Speak

PERMISSÕES DE CANAL:

{
  "role": "Nome do cargo",
  "allow": [],
  "deny": []
}

EXEMPLO DE PEDIDO DO USUÁRIO:

"Quero um servidor para uma comunidade de jogos.
Quero uma área de informações, uma área de comunidade,
uma área para campeonatos, salas de voz e uma área privada
para a staff."

Você deve transformar isso em JSON seguindo exatamente
o formato definido acima.

AGORA AGUARDE A DESCRIÇÃO DO SERVIDOR DO USUÁRIO.
`;

/*
====================================================
 MODELO JSON
====================================================
*/

const JSON_EXAMPLE = {
    name: "Meu Servidor",

    roles: [
        {
            name: "Administrador",
            color: "#5865F2",
            permissions: [
                "ManageGuild",
                "ManageChannels",
                "ManageMessages"
            ]
        },
        {
            name: "Membro",
            color: "#2ECC71",
            permissions: []
        }
    ],

    categories: [
        {
            name: "INFORMAÇÕES",
            channels: [
                {
                    name: "regras",
                    type: "text",
                    topic: "Regras do servidor",
                    readOnly: true,
                    permissions: []
                },
                {
                    name: "chat-geral",
                    type: "text",
                    topic: "Conversa da comunidade",
                    readOnly: false,
                    permissions: []
                },
                {
                    name: "Lounge",
                    type: "voice",
                    permissions: []
                }
            ]
        }
    ]
};

/*
====================================================
 COMANDOS
====================================================
*/

const commands = [
    new SlashCommandBuilder()
        .setName("painel-template")
        .setDescription("Abre o painel de criação e administração de templates.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator.toString()
        ),

    new SlashCommandBuilder()
        .setName("template-status")
        .setDescription("Mostra informações sobre o sistema de templates.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator.toString()
        )
].map(command => command.toJSON());

/*
====================================================
 PAINEL
====================================================
*/

function createPanel() {
    const embed = new EmbedBuilder()
        .setTitle("🤖 Bot Template")
        .setDescription(
            "Crie a estrutura completa de um servidor Discord através de uma configuração gerada por IA.\n\n" +
            "Escolha uma opção abaixo."
        )
        .addFields(
            {
                name: "🚀 Gerar Template",
                value: "Envie o arquivo JSON criado pela IA."
            },
            {
                name: "✨ Prompt para IA",
                value: "Receba o prompt oficial para criar seu servidor."
            },
            {
                name: "📖 Tutorial",
                value: "Aprenda como criar e importar um template."
            },
            {
                name: "📋 Modelo JSON",
                value: "Veja um exemplo do formato aceito."
            },
            {
                name: "⚙️ Administrar",
                value: "Informações e ferramentas administrativas."
            }
        )
        .setFooter({
            text: "Somente administradores podem utilizar este painel."
        });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("template_generate")
            .setLabel("Gerar Template")
            .setEmoji("🚀")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("template_prompt")
            .setLabel("Prompt para IA")
            .setEmoji("✨")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("template_tutorial")
            .setLabel("Tutorial")
            .setEmoji("📖")
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("template_example")
            .setLabel("Modelo JSON")
            .setEmoji("📋")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("template_admin")
            .setLabel("Administrar")
            .setEmoji("⚙️")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [row1, row2]
    };
}

/*
====================================================
 VERIFICAÇÃO DE ADMIN
====================================================
*/

function isAdmin(interaction) {
    return interaction.member?.permissions?.has(
        PermissionFlagsBits.Administrator
    );
}

/*
====================================================
 TUTORIAL
====================================================
*/

function tutorialEmbed() {
    return new EmbedBuilder()
        .setTitle("📖 Como criar seu Template")
        .setDescription(
            "**1️⃣ Crie o projeto com uma IA**\n" +
            "Use o botão **Prompt para IA** e copie o prompt oficial.\n\n" +

            "**2️⃣ Explique o servidor que você quer**\n" +
            "Diga para a IA quais cargos, categorias, canais e permissões deseja.\n\n" +

            "**3️⃣ Gere o arquivo**\n" +
            "A IA deverá devolver somente o JSON no formato solicitado.\n\n" +

            "**4️⃣ Salve o arquivo**\n" +
            "Salve como, por exemplo:\n" +
            "`meu-servidor.json`\n\n" +

            "**5️⃣ Importe no bot**\n" +
            "Clique em **Gerar Template** e envie o arquivo.\n\n" +

            "**6️⃣ O bot cria a estrutura**\n" +
            "Os cargos, categorias, canais e permissões serão criados automaticamente."
        );
}

/*
====================================================
 VALIDAÇÃO DO JSON
====================================================
*/

function validateTemplate(data) {
    if (!data || typeof data !== "object") {
        return "O arquivo não contém um objeto JSON válido.";
    }

    if (typeof data.name !== "string") {
        return "O campo `name` é obrigatório.";
    }

    if (!Array.isArray(data.roles)) {
        return "O campo `roles` precisa ser uma lista.";
    }

    if (!Array.isArray(data.categories)) {
        return "O campo `categories` precisa ser uma lista.";
    }

    if (data.roles.length > 50) {
        return "O template possui cargos demais. Limite: 50.";
    }

    if (data.categories.length > 50) {
        return "O template possui categorias demais. Limite: 50.";
    }

    for (const role of data.roles) {
        if (!role.name || typeof role.name !== "string") {
            return "Existe um cargo sem nome válido.";
        }

        if (
            role.permissions &&
            !Array.isArray(role.permissions)
        ) {
            return `As permissões do cargo "${role.name}" precisam ser uma lista.`;
        }
    }

    for (const category of data.categories) {
        if (!category.name) {
            return "Existe uma categoria sem nome.";
        }

        if (!Array.isArray(category.channels)) {
            return `A categoria "${category.name}" não possui uma lista de canais válida.`;
        }

        if (category.channels.length > 50) {
            return `A categoria "${category.name}" possui canais demais.`;
        }

        for (const channel of category.channels) {
            if (!channel.name) {
                return `Existe um canal sem nome na categoria "${category.name}".`;
            }

            if (
                channel.type !== "text" &&
                channel.type !== "voice"
            ) {
                return `O canal "${channel.name}" possui um tipo inválido.`;
            }
        }
    }

    return null;
}

/*
====================================================
 PERMISSÕES
====================================================
*/

const permissionMap = {
    Administrator: PermissionFlagsBits.Administrator,
    ManageGuild: PermissionFlagsBits.ManageGuild,
    ManageChannels: PermissionFlagsBits.ManageChannels,
    ManageMessages: PermissionFlagsBits.ManageMessages,
    KickMembers: PermissionFlagsBits.KickMembers,
    BanMembers: PermissionFlagsBits.BanMembers,
    ModerateMembers: PermissionFlagsBits.ModerateMembers,
    MentionEveryone: PermissionFlagsBits.MentionEveryone,
    ViewChannel: PermissionFlagsBits.ViewChannel,
    SendMessages: PermissionFlagsBits.SendMessages,
    Connect: PermissionFlagsBits.Connect,
    Speak: PermissionFlagsBits.Speak
};

function convertPermissions(permissions = []) {
    return permissions
        .map(permission => permissionMap[permission])
        .filter(Boolean);
}

/*
====================================================
 CRIAÇÃO DO TEMPLATE
====================================================
*/

async function createTemplate(guild, template) {

    const createdRoles = new Map();

    console.log(`📦 Criando template: ${template.name}`);

    /*
    -------------------------
    CARGOS
    -------------------------
    */

    for (const roleData of template.roles) {

        const existingRole = guild.roles.cache.find(
            role => role.name === roleData.name
        );

        if (existingRole) {
            createdRoles.set(roleData.name, existingRole);
            console.log(`↪️ Cargo já existe: ${roleData.name}`);
            continue;
        }

        const role = await guild.roles.create({
            name: roleData.name,
            color: roleData.color || "#5865F2",
            permissions: convertPermissions(
                roleData.permissions || []
            ),
            reason: "Bot Template"
        });

        createdRoles.set(roleData.name, role);

        console.log(`✅ Cargo criado: ${roleData.name}`);
    }

    /*
    -------------------------
    CATEGORIAS
    -------------------------
    */

    for (const categoryData of template.categories) {

        let category = guild.channels.cache.find(
            channel =>
                channel.type === ChannelType.GuildCategory &&
                channel.name === categoryData.name
        );

        if (!category) {
            category = await guild.channels.create({
                name: categoryData.name,
                type: ChannelType.GuildCategory,
                reason: "Bot Template"
            });

            console.log(
                `✅ Categoria criada: ${categoryData.name}`
            );
        } else {
            console.log(
                `↪️ Categoria já existe: ${categoryData.name}`
            );
        }

        /*
        -------------------------
        CANAIS
        -------------------------
        */

        for (const channelData of categoryData.channels) {

            const channelType =
                channelData.type === "voice"
                    ? ChannelType.GuildVoice
                    : ChannelType.GuildText;

            let channel = guild.channels.cache.find(
                c =>
                    c.name === channelData.name &&
                    c.parentId === category.id &&
                    c.type === channelType
            );

            if (!channel) {

                channel = await guild.channels.create({
                    name: channelData.name,
                    type: channelType,
                    parent: category.id,
                    topic:
                        channelType === ChannelType.GuildText
                            ? channelData.topic || undefined
                            : undefined,
                    reason: "Bot Template"
                });

                console.log(
                    `✅ Canal criado: ${channelData.name}`
                );

            } else {

                console.log(
                    `↪️ Canal já existe: ${channelData.name}`
                );
            }

            /*
            -------------------------
            READ ONLY
            -------------------------
            */

            if (
                channelType === ChannelType.GuildText &&
                channelData.readOnly === true
            ) {
                await channel.permissionOverwrites.edit(
                    guild.roles.everyone,
                    {
                        SendMessages: false
                    }
                );
            }

            /*
            -------------------------
            PERMISSÕES
            -------------------------
            */

            if (Array.isArray(channelData.permissions)) {

                for (const permission of channelData.permissions) {

                    const role =
                        createdRoles.get(permission.role) ||
                        guild.roles.cache.find(
                            r => r.name === permission.role
                        );

                    if (!role) {
                        console.log(
                            `⚠️ Cargo não encontrado: ${permission.role}`
                        );
                        continue;
                    }

                    const allow = convertPermissions(
                        permission.allow || []
                    );

                    const deny = convertPermissions(
                        permission.deny || []
                    );

                    await channel.permissionOverwrites.edit(
                        role,
                        {
                            Allow: allow,
                            Deny: deny
                        }
                    );
                }
            }
        }
    }
}

/*
====================================================
 RECEBER ARQUIVO
====================================================
*/

async function waitForTemplateFile(interaction) {

    const channel = interaction.channel;

    if (!channel) {
        return null;
    }

    const filter = message => {

        if (message.author.id !== interaction.user.id) {
            return false;
        }

        const attachment =
            message.attachments.first();

        if (!attachment) {
            return false;
        }

        return attachment.name
            .toLowerCase()
            .endsWith(".json");
    };

    try {

        const collected =
            await channel.awaitMessages({
                filter,
                max: 1,
                time: UPLOAD_TIMEOUT,
                errors: ["time"]
            });

        return collected.first();

    } catch {
        return null;
    }
}

/*
====================================================
 DOWNLOAD DO JSON
====================================================
*/

async function downloadJSON(url) {

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Não foi possível baixar o arquivo. HTTP ${response.status}`
        );
    }

    const text = await response.text();

    return JSON.parse(text);
}

/*
====================================================
 INTERAÇÕES
====================================================
*/

client.on("interactionCreate", async interaction => {

    /*
    ================================
    SLASH COMMAND
    ================================
    */

    if (interaction.isChatInputCommand()) {

        if (!isAdmin(interaction)) {

            return interaction.reply({
                content:
                    "❌ Você precisa ter **Administrador** para utilizar o sistema de templates.",
                ephemeral: true
            });
        }

        if (interaction.commandName === "painel-template") {

            return interaction.reply({
                ...createPanel(),
                ephemeral: false
            });
        }

        if (interaction.commandName === "template-status") {

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("⚙️ Status do Template")
                        .setDescription(
                            "O sistema de templates está online.\n\n" +
                            `👤 Administrador: ${interaction.user}\n` +
                            `🏠 Servidor: ${interaction.guild.name}\n` +
                            "🤖 Sistema: Online"
                        )
                ],
                ephemeral: true
            });
        }
    }

    /*
    ================================
    BOTÕES
    ================================
    */

    if (interaction.isButton()) {

        if (!isAdmin(interaction)) {

            return interaction.reply({
                content:
                    "❌ Apenas administradores podem utilizar o sistema de templates.",
                ephemeral: true
            });
        }

        /*
        PROMPT
        */

        if (interaction.customId === "template_prompt") {

            return interaction.reply({
                content:
                    "✨ **PROMPT OFICIAL DO BOT**\n\n" +
                    "Copie o texto abaixo e envie para a IA. " +
                    "Depois acrescente a descrição de como você quer seu servidor.\n\n" +
                    "```text\n" +
                    AI_PROMPT +
                    "\n```",
                ephemeral: true
            });
        }

        /*
        TUTORIAL
        */

        if (interaction.customId === "template_tutorial") {

            return interaction.reply({
                embeds: [tutorialEmbed()],
                ephemeral: true
            });
        }

        /*
        MODELO
        */

        if (interaction.customId === "template_example") {

            const json = JSON.stringify(
                JSON_EXAMPLE,
                null,
                2
            );

            return interaction.reply({
                content:
                    "📋 **MODELO DE ARQUIVO JSON**\n\n" +
                    "```json\n" +
                    json +
                    "\n```",
                ephemeral: true
            });
        }

        /*
        ADMINISTRAÇÃO
        */

        if (interaction.customId === "template_admin") {

            const embed = new EmbedBuilder()
                .setTitle("⚙️ Administração do Template")
                .setDescription(
                    "Ferramentas administrativas do sistema."
                )
                .addFields(
                    {
                        name: "🔐 Segurança",
                        value:
                            "Somente administradores podem executar as ferramentas."
                    },
                    {
                        name: "♻️ Duplicação",
                        value:
                            "O sistema verifica cargos, categorias e canais existentes antes de criar novos."
                    },
                    {
                        name: "🧩 Importação",
                        value:
                            "A estrutura é determinada pelo arquivo JSON enviado."
                    },
                    {
                        name: "📊 Status",
                        value:
                            "Use `/template-status` para verificar o sistema."
                    }
                );

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        /*
        GERAR TEMPLATE
        */

        if (interaction.customId === "template_generate") {

            await interaction.reply({
                content:
                    "🚀 **Gerar Template**\n\n" +
                    "Envie agora **um arquivo `.json`** neste canal.\n\n" +
                    "⏱️ Você tem 2 minutos.\n" +
                    "📦 Tamanho máximo: 1 MB.",
                ephemeral: true
            });

            const message =
                await waitForTemplateFile(interaction);

            if (!message) {

                return interaction.followUp({
                    content:
                        "⏱️ Não recebi um arquivo JSON dentro do tempo limite.",
                    ephemeral: true
                });
            }

            const attachment =
                message.attachments.first();

            if (attachment.size > MAX_FILE_SIZE) {

                return interaction.followUp({
                    content:
                        "❌ O arquivo ultrapassa o limite de 1 MB.",
                    ephemeral: true
                });
            }

            try {

                await interaction.followUp({
                    content:
                        "📥 Arquivo recebido. Validando template...",
                    ephemeral: true
                });

                const template =
                    await downloadJSON(attachment.url);

                const validation =
                    validateTemplate(template);

                if (validation) {

                    return interaction.followUp({
                        content:
                            `❌ **Template inválido:**\n${validation}`,
                        ephemeral: true
                    });
                }

                await interaction.followUp({
                    content:
                        "⚙️ Template válido. Começando a criação...",
                    ephemeral: true
                });

                await createTemplate(
                    interaction.guild,
                    template
                );

                await interaction.followUp({
                    content:
                        "✅ **Template criado com sucesso!**\n\n" +
                        `📁 Template: **${template.name}**\n` +
                        "♻️ Itens existentes foram preservados para evitar duplicações.",
                    ephemeral: true
                });

            } catch (error) {

                console.error(
                    "❌ ERRO AO IMPORTAR TEMPLATE:",
                    error
                );

                await interaction.followUp({
                    content:
                        "❌ Não foi possível processar o arquivo.\n\n" +
                        "Verifique se ele é um JSON válido e segue o formato do bot.",
                    ephemeral: true
                });
            }
        }
    }
});

/*
====================================================
 REGISTRO
====================================================
*/

async function registerCommands() {

    const rest =
        new REST({ version: "10" })
            .setToken(TOKEN);

    try {

        console.log("🔄 Registrando comandos...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log(
            "✅ Comandos registrados com sucesso."
        );

    } catch (error) {

        console.error(
            "❌ Erro ao registrar comandos:",
            error
        );
    }
}

/*
====================================================
 LOGIN
====================================================
*/

client.once("clientReady", async () => {

    console.log(
        `✅ Bot online como ${client.user.tag}`
    );

    await registerCommands();
});

client.login(TOKEN);
