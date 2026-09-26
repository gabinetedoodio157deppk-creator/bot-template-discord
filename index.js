const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  Events
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("ERRO: A variável TOKEN não foi configurada.");
  process.exit(1);
}

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const SUPPORTED_CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  stage: ChannelType.GuildStageVoice,
  media: ChannelType.GuildMedia
};

const VALID_PERMISSION_NAMES = new Set(
  Object.keys(PermissionFlagsBits)
);

/* =========================================================
   UTILITÁRIOS
========================================================= */

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function normalizePermission(permission) {
  if (!permission) return null;

  const found = Object.keys(PermissionFlagsBits).find(
    key => key.toLowerCase() === String(permission).toLowerCase()
  );

  return found || null;
}

function permissionsToObject(permissions = []) {
  const result = {};

  for (const permission of permissions) {
    const normalized = normalizePermission(permission);

    if (normalized) {
      result[normalized] = true;
    }
  }

  return result;
}

function overwriteToObject(overwrite) {
  const result = {};

  for (const permission of overwrite.allow || []) {
    const normalized = normalizePermission(permission);

    if (normalized) {
      result[normalized] = true;
    }
  }

  for (const permission of overwrite.deny || []) {
    const normalized = normalizePermission(permission);

    if (normalized) {
      result[normalized] = false;
    }
  }

  return result;
}

function safeColor(color) {
  if (!color) return null;

  if (typeof color !== "string") {
    return null;
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return null;
  }

  return color;
}

function sanitizeName(name) {
  return String(name)
    .trim()
    .replace(/^#/, "")
    .slice(0, 100);
}

/* =========================================================
   VALIDAÇÃO DO TEMPLATE
========================================================= */

function validateTemplate(template) {
  const errors = [];

  if (!template || typeof template !== "object") {
    errors.push("O JSON precisa ser um objeto.");
    return errors;
  }

  if (!Array.isArray(template.roles)) {
    errors.push("O campo 'roles' precisa ser uma lista.");
  }

  if (!Array.isArray(template.categories)) {
    errors.push("O campo 'categories' precisa ser uma lista.");
  }

  if (!Array.isArray(template.channels)) {
    errors.push("O campo 'channels' precisa ser uma lista.");
  }

  if (Array.isArray(template.roles)) {
    for (const role of template.roles) {
      if (!role.name) {
        errors.push("Existe um cargo sem nome.");
      }

      if (role.permissions && !Array.isArray(role.permissions)) {
        errors.push(
          `As permissões do cargo "${role.name}" precisam ser uma lista.`
        );
      }

      for (const permission of role.permissions || []) {
        if (!normalizePermission(permission)) {
          errors.push(
            `Permissão inválida no cargo "${role.name}": ${permission}`
          );
        }
      }
    }
  }

  if (Array.isArray(template.categories)) {
    for (const category of template.categories) {
      if (!category.name) {
        errors.push("Existe uma categoria sem nome.");
      }
    }
  }

  if (Array.isArray(template.channels)) {
    for (const channel of template.channels) {
      if (!channel.name) {
        errors.push("Existe um canal sem nome.");
      }

      if (!channel.type) {
        errors.push(
          `O canal "${channel.name || "sem nome"}" não possui tipo.`
        );
      }

      if (channel.type && !SUPPORTED_CHANNEL_TYPES[channel.type]) {
        errors.push(
          `Tipo de canal inválido: ${channel.type}`
        );
      }
    }
  }

  return errors;
}

/* =========================================================
   CRIAÇÃO DOS CARGOS
========================================================= */

async function createRoles(guild, template) {
  const roleMap = new Map();

  const roles = [...template.roles].sort(
    (a, b) => (a.position || 0) - (b.position || 0)
  );

  for (const roleData of roles) {
    if (!roleData.name) continue;

    const existing = guild.roles.cache.find(
      role => role.name === roleData.name
    );

    if (existing) {
      roleMap.set(roleData.name, existing);
      continue;
    }

    try {
      const role = await guild.roles.create({
        name: sanitizeName(roleData.name),
        color: safeColor(roleData.color) || undefined,
        hoist: Boolean(roleData.hoist),
        mentionable: Boolean(roleData.mentionable),
        permissions: permissionsToObject(roleData.permissions || []),
        reason: "Criação de template pelo bot"
      });

      roleMap.set(roleData.name, role);

    } catch (error) {
      console.error(
        `Erro ao criar cargo ${roleData.name}:`,
        error.message
      );
    }
  }

  /*
   * Ajuste de hierarquia.
   *
   * O Discord não permite que o bot coloque um cargo
   * acima do maior cargo que pertence ao próprio bot.
   */

  for (const roleData of roles) {
    const role = roleMap.get(roleData.name);

    if (!role) continue;

    if (typeof roleData.position !== "number") continue;

    try {
      await role.setPosition(roleData.position);
    } catch (error) {
      console.log(
        `Não foi possível posicionar o cargo ${roleData.name}: ${error.message}`
      );
    }
  }

  return roleMap;
}

/* =========================================================
   PERMISSÕES
========================================================= */

function resolveOverwriteRole(guild, roleMap, roleName) {
  if (!roleName) return null;

  if (roleName === "@everyone") {
    return guild.roles.everyone;
  }

  return roleMap.get(roleName) || null;
}

async function applyPermissionOverwrites(
  channel,
  overwrites,
  guild,
  roleMap
) {
  if (!Array.isArray(overwrites)) return;

  for (const overwrite of overwrites) {
    const role = resolveOverwriteRole(
      guild,
      roleMap,
      overwrite.role
    );

    if (!role) {
      console.log(
        `Cargo não encontrado para permissionOverwrite: ${overwrite.role}`
      );
      continue;
    }

    const permissions = overwriteToObject(overwrite);

    try {
      await channel.permissionOverwrites.edit(
        role,
        permissions
      );
    } catch (error) {
      console.error(
        `Erro nas permissões do canal ${channel.name}:`,
        error.message
      );
    }
  }
}

/* =========================================================
   CRIAÇÃO DAS CATEGORIAS
========================================================= */

async function createCategories(guild, template, roleMap) {
  const categoryMap = new Map();

  const categories = [...template.categories].sort(
    (a, b) => (a.position || 0) - (b.position || 0)
  );

  for (const categoryData of categories) {
    const existing = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === categoryData.name
    );

    let category = existing;

    if (!category) {
      try {
        category = await guild.channels.create({
          name: sanitizeName(categoryData.name),
          type: ChannelType.GuildCategory,
          reason: "Criação de template pelo bot"
        });
      } catch (error) {
        console.error(
          `Erro ao criar categoria ${categoryData.name}:`,
          error.message
        );

        continue;
      }
    }

    categoryMap.set(categoryData.name, category);

    await applyPermissionOverwrites(
      category,
      categoryData.permissionOverwrites,
      guild,
      roleMap
    );
  }

  return categoryMap;
}

/* =========================================================
   CRIAÇÃO DOS CANAIS
========================================================= */

async function createChannels(
  guild,
  template,
  categoryMap,
  roleMap
) {
  const channels = [...template.channels].sort(
    (a, b) => (a.position || 0) - (b.position || 0)
  );

  for (const channelData of channels) {
    const type =
      SUPPORTED_CHANNEL_TYPES[channelData.type];

    if (!type) continue;

    const category =
      categoryMap.get(channelData.category);

    const existing = guild.channels.cache.find(
      channel =>
        channel.name === channelData.name &&
        channel.type === type
    );

    let channel = existing;

    if (!channel) {
      try {
        const options = {
          name: sanitizeName(channelData.name),
          type,
          reason: "Criação de template pelo bot"
        };

        if (category) {
          options.parent = category.id;
        }

        if (
          channelData.type === "text" ||
          channelData.type === "announcement"
        ) {
          if (channelData.topic) {
            options.topic =
              String(channelData.topic).slice(0, 1024);
          }

          options.nsfw =
            Boolean(channelData.nsfw);
        }

        channel =
          await guild.channels.create(options);

      } catch (error) {
        console.error(
          `Erro ao criar canal ${channelData.name}:`,
          error.message
        );

        continue;
      }
    }

    await applyPermissionOverwrites(
      channel,
      channelData.permissionOverwrites,
      guild,
      roleMap
    );

    if (
      typeof channelData.position === "number"
    ) {
      try {
        await channel.setPosition(
          channelData.position
        );
      } catch (error) {
        console.log(
          `Não foi possível posicionar ${channel.name}: ${error.message}`
        );
      }
    }
  }
}

/* =========================================================
   APLICAÇÃO COMPLETA
========================================================= */

async function applyTemplate(guild, template) {
  const errors = validateTemplate(template);

  if (errors.length > 0) {
    throw new Error(
      "JSON inválido:\n" +
      errors.join("\n")
    );
  }

  const roleMap =
    await createRoles(guild, template);

  const categoryMap =
    await createCategories(
      guild,
      template,
      roleMap
    );

  await createChannels(
    guild,
    template,
    categoryMap,
    roleMap
  );

  return {
    roles: roleMap.size,
    categories: categoryMap.size,
    channels: template.channels.length
  };
}

/* =========================================================
   PROMPT DA IA
========================================================= */

function getPromptAttachment() {
  const path = "./PROMPT_IA_TEMPLATE.txt";

  if (!fs.existsSync(path)) {
    return null;
  }

  return new AttachmentBuilder(path, {
    name: "PROMPT_IA_TEMPLATE.txt"
  });
}

/* =========================================================
   PAINEL
========================================================= */

function createPanel() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gerar_template")
      .setLabel("Gerar Template")
      .setEmoji("🚀")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("tutorial")
      .setLabel("Tutorial")
      .setEmoji("📖")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("prompt_ia")
      .setLabel("Prompt para IA")
      .setEmoji("✨")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("modelo_json")
      .setLabel("Modelo JSON")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("administrar")
      .setLabel("Administrar")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("status")
      .setLabel("Status")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

/* =========================================================
   TUTORIAL
========================================================= */

async function showTutorial(interaction) {
  await interaction.reply({
    ephemeral: true,
    content:
      "**📖 Como usar o bot**\n\n" +
      "**1️⃣ Prompt para IA**\n" +
      "Clique em `✨ Prompt para IA` e envie o prompt para uma IA.\n\n" +
      "**2️⃣ Descreva seu servidor**\n" +
      "Explique como você quer os cargos, categorias, canais e permissões.\n\n" +
      "**3️⃣ Gere o JSON**\n" +
      "A IA deve responder somente com JSON válido.\n\n" +
      "**4️⃣ Gerar Template**\n" +
      "Clique em `🚀 Gerar Template` e envie o arquivo `.json`.\n\n" +
      "**5️⃣ O bot cria tudo**\n" +
      "Cargos, permissões, categorias, canais e restrições serão aplicados.\n\n" +
      "⚠️ O bot continua sujeito às limitações da API e da hierarquia do Discord."
  });
}

/* =========================================================
   RECEBER JSON
========================================================= */

async function waitForJson(interaction) {
  const channel = interaction.channel;

  if (!channel) {
    throw new Error("Não foi possível acessar este canal.");
  }

  await interaction.editReply({
    content:
      "📎 **Envie agora o arquivo `.json` neste canal.**\n\n" +
      "O arquivo deve conter a configuração do template.\n" +
      "Você tem **2 minutos** para enviar."
  });

  const filter = message => {
    if (message.author.id !== interaction.user.id) {
      return false;
    }

    return message.attachments.some(
      attachment =>
        attachment.name.toLowerCase().endsWith(".json")
    );
  };

  const collected =
    await channel.awaitMessages({
      filter,
      max: 1,
      time: 120000,
      errors: ["time"]
    });

  const message = collected.first();

  if (!message) {
    throw new Error(
      "Tempo esgotado. Nenhum JSON foi enviado."
    );
  }

  const attachment =
    message.attachments.find(
      file =>
        file.name.toLowerCase().endsWith(".json")
    );

  if (!attachment) {
    throw new Error(
      "Nenhum arquivo JSON encontrado."
    );
  }

  const response =
    await fetch(attachment.url);

  if (!response.ok) {
    throw new Error(
      "Não foi possível baixar o arquivo JSON."
    );
  }

  const text =
    await response.text();

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      "O arquivo não contém JSON válido."
    );
  }

  return json;
}

/* =========================================================
   EVENTOS
========================================================= */

client.once(Events.ClientReady, async readyClient => {
  console.log(
    `Bot online: ${readyClient.user.tag}`
  );

  try {
    const guilds = readyClient.guilds.cache;

    for (const guild of guilds.values()) {
      await guild.commands.set([
        {
          name: "painel",
          description:
            "Abre o painel de criação de templates"
        },
        {
          name: "gerartemplate",
          description:
            "Inicia a criação de um template"
        }
      ]);
    }

    console.log(
      "Comandos registrados."
    );

  } catch (error) {
    console.error(
      "Erro ao registrar comandos:",
      error
    );
  }
});

/* =========================================================
   SLASH COMMANDS
========================================================= */

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {

      /* ================================
         COMANDOS
      ================================= */

      if (interaction.isChatInputCommand()) {

        if (!interaction.guild) {
          await interaction.reply({
            content:
              "❌ Este comando só pode ser usado dentro de um servidor.",
            ephemeral: true
          });

          return;
        }

        if (!isAdmin(interaction.member)) {
          await interaction.reply({
            content:
              "❌ Apenas administradores podem usar este bot.",
            ephemeral: true
          });

          return;
        }

        if (interaction.commandName === "painel") {

          await interaction.reply({
            content:
              "## 🤖 Gerenciador de Templates\n\n" +
              "Use os botões abaixo para criar e administrar templates do servidor.",
            components: createPanel()
          });

          return;
        }

        if (
          interaction.commandName ===
          "gerartemplate"
        ) {

          await interaction.reply({
            content:
              "🚀 **Gerar Template**\n\n" +
              "Envie o arquivo `.json` neste canal.",
            ephemeral: true
          });

          try {

            const template =
              await waitForJson(interaction);

            await interaction.editReply({
              content:
                "🔍 JSON recebido. Validando..."
            });

            const errors =
              validateTemplate(template);

            if (errors.length > 0) {
              await interaction.editReply({
                content:
                  "❌ **JSON inválido:**\n\n" +
                  errors.map(e => `• ${e}`).join("\n")
              });

              return;
            }

            await interaction.editReply({
              content:
                "⚙️ JSON válido. Criando estrutura..."
            });

            const result =
              await applyTemplate(
                interaction.guild,
                template
              );

            await interaction.editReply({
              content:
                "✅ **Template criado com sucesso!**\n\n" +
                `👤 Cargos processados: **${result.roles}**\n` +
                `📁 Categorias processadas: **${result.categories}**\n` +
                `💬 Canais processados: **${result.channels}**`
            });

          } catch (error) {

            console.error(error);

            await interaction.editReply({
              content:
                "❌ **Erro ao gerar o template:**\n\n" +
                String(error.message || error).slice(
                  0,
                  1800
                )
            });
          }

          return;
        }
      }

      /* ================================
         BOTÕES
      ================================= */

      if (interaction.isButton()) {

        if (!interaction.guild) {
          await interaction.reply({
            content:
              "❌ Este botão só funciona dentro de um servidor.",
            ephemeral: true
          });

          return;
        }

        if (!isAdmin(interaction.member)) {
          await interaction.reply({
            content:
              "❌ Apenas administradores podem usar o bot.",
            ephemeral: true
          });

          return;
        }

        /* ================================
           PROMPT IA
        ================================= */

        if (
          interaction.customId ===
          "prompt_ia"
        ) {

          const attachment =
            getPromptAttachment();

          if (!attachment) {
            await interaction.reply({
              content:
                "❌ O arquivo `PROMPT_IA_TEMPLATE.txt` não foi encontrado no projeto.",
              ephemeral: true
            });

            return;
          }

          await interaction.reply({
            content:
              "✨ **Prompt oficial para IA**\n\n" +
              "Enviei o prompt completo como arquivo abaixo. Abra, copie e envie para a IA que você quiser.",
            files: [attachment],
            ephemeral: true
          });

          return;
        }

        /* ================================
           MODELO JSON
        ================================= */

        if (
          interaction.customId ===
          "modelo_json"
        ) {

          const path =
            "./MODELO_TEMPLATE.json";

          if (!fs.existsSync(path)) {
            await interaction.reply({
              content:
                "❌ O arquivo `MODELO_TEMPLATE.json` não foi encontrado.",
              ephemeral: true
            });

            return;
          }

          const attachment =
            new AttachmentBuilder(path, {
              name: "MODELO_TEMPLATE.json"
            });

          await interaction.reply({
            content:
              "📋 **Modelo JSON**\n\n" +
              "Use este arquivo como exemplo da estrutura aceita pelo bot.",
            files: [attachment],
            ephemeral: true
          });

          return;
        }

        /* ================================
           GERAR TEMPLATE
        ================================= */

        if (
          interaction.customId ===
          "gerar_template"
        ) {

          await interaction.reply({
            content:
              "🚀 **Gerar Template**\n\n" +
              "Envie agora o arquivo `.json` neste canal.",
            ephemeral: true
          });

          try {

            const template =
              await waitForJson(interaction);

            await interaction.editReply({
              content:
                "🔍 JSON recebido. Validando..."
            });

            const errors =
              validateTemplate(template);

            if (errors.length > 0) {

              await interaction.editReply({
                content:
                  "❌ **Seu JSON possui erros:**\n\n" +
                  errors
                    .map(e => `• ${e}`)
                    .join("\n")
                    .slice(0, 1800)
              });

              return;
            }

            await interaction.editReply({
              content:
                "⚙️ **JSON válido!**\n\n" +
                "Criando cargos, categorias, canais e permissões..."
            });

            const result =
              await applyTemplate(
                interaction.guild,
                template
              );

            await interaction.editReply({
              content:
                "✅ **Template criado!**\n\n" +
                `👤 Cargos: **${result.roles}**\n` +
                `📁 Categorias: **${result.categories}**\n` +
                `💬 Canais: **${result.channels}**\n\n` +
                "⚠️ Cargos acima do maior cargo do bot não podem ser gerenciados pelo Discord."
            });

          } catch (error) {

            console.error(
              "Erro ao gerar template:",
              error
            );

            await interaction.editReply({
              content:
                "❌ **Não foi possível criar o template.**\n\n" +
                String(
                  error.message || error
                ).slice(0, 1800)
            });
          }

          return;
        }

        /* ================================
           TUTORIAL
        ================================= */

        if (
          interaction.customId ===
          "tutorial"
        ) {

          await showTutorial(
            interaction
          );

          return;
        }

        /* ================================
           STATUS
        ================================= */

        if (
          interaction.customId ===
          "status"
        ) {

          const guild =
            interaction.guild;

          const botMember =
            guild.members.me;

          await interaction.reply({
            content:
              "📊 **Status do Bot**\n\n" +
              `🤖 Bot: **${client.user.tag}**\n` +
              `🏠 Servidor: **${guild.name}**\n` +
              `👥 Membros: **${guild.memberCount}**\n` +
              `🎭 Cargos: **${guild.roles.cache.size}**\n` +
              `💬 Canais: **${guild.channels.cache.size}**\n` +
              `⚡ Ping: **${client.ws.ping}ms**\n` +
              `🔐 Cargo máximo do bot: **${botMember?.roles.highest?.name || "Desconhecido"}**`,
            ephemeral: true
          });

          return;
        }

        /* ================================
           ADMINISTRAR
        ================================= */

        if (
          interaction.customId ===
          "administrar"
        ) {

          await interaction.reply({
            content:
              "⚙️ **Administração**\n\n" +
              "O bot está configurado para aceitar comandos e ações somente de administradores.\n\n" +
              "Permissões do template são aplicadas conforme o JSON enviado.\n\n" +
              "⚠️ O Discord impede o bot de modificar cargos que estejam acima do maior cargo dele.",
            ephemeral: true
          });

          return;
        }
      }

    } catch (error) {

      console.error(
        "Erro geral na interação:",
        error
      );

      try {

        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction.followUp({
            content:
              "❌ Ocorreu um erro ao processar essa ação.",
            ephemeral: true
          });

        } else {

          await interaction.reply({
            content:
              "❌ Ocorreu um erro ao processar essa ação.",
            ephemeral: true
          });

        }

      } catch {}
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

client.login(TOKEN);
