const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ A variável TOKEN não foi configurada no Render.");
  process.exit(1);
}

/* =========================================================
   TIPOS DE CANAL
========================================================= */

const SUPPORTED_CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  stage: ChannelType.GuildStageVoice
};

// Só adiciona media se a versão instalada do discord.js suportar.
if (ChannelType.GuildMedia !== undefined) {
  SUPPORTED_CHANNEL_TYPES.media = ChannelType.GuildMedia;
}

/* =========================================================
   COMANDO /PAINEL
========================================================= */

const painelCommand = new SlashCommandBuilder()
  .setName("painel")
  .setDescription("Abre o painel de gerenciamento de templates")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator
  )
  .toJSON();

/* =========================================================
   FUNÇÕES BÁSICAS
========================================================= */

function isAdmin(member) {
  return Boolean(
    member &&
    member.permissions &&
    member.permissions.has(
      PermissionFlagsBits.Administrator
    )
  );
}

function normalizePermission(permission) {
  if (!permission) return null;

  const wanted = String(permission).toLowerCase();

  return (
    Object.keys(PermissionFlagsBits).find(
      key => key.toLowerCase() === wanted
    ) || null
  );
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

function overwriteToObject(overwrite = {}) {
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
  if (
    typeof color === "string" &&
    /^#[0-9A-Fa-f]{6}$/.test(color)
  ) {
    return color;
  }

  return null;
}

function safeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 100);
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
      .setCustomId("prompt_ia")
      .setLabel("Prompt IA")
      .setEmoji("✨")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("modelo_json")
      .setLabel("Modelo")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tutorial")
      .setLabel("Tutorial")
      .setEmoji("📖")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("status")
      .setLabel("Status")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("administrar")
      .setLabel("Administrar")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

/* =========================================================
   VALIDAÇÃO DO JSON
========================================================= */

function validateTemplate(template) {
  const errors = [];

  if (!template || typeof template !== "object") {
    return ["O arquivo precisa conter um objeto JSON válido."];
  }

  if (
    template.roles !== undefined &&
    !Array.isArray(template.roles)
  ) {
    errors.push("'roles' precisa ser uma lista.");
  }

  if (
    template.categories !== undefined &&
    !Array.isArray(template.categories)
  ) {
    errors.push("'categories' precisa ser uma lista.");
  }

  if (
    template.channels !== undefined &&
    !Array.isArray(template.channels)
  ) {
    errors.push("'channels' precisa ser uma lista.");
  }

  for (const role of template.roles || []) {
    if (!role.name) {
      errors.push("Existe um cargo sem nome.");
    }

    for (const permission of role.permissions || []) {
      if (!normalizePermission(permission)) {
        errors.push(
          `Permissão inválida no cargo "${role.name}": ${permission}`
        );
      }
    }
  }

  for (const category of template.categories || []) {
    if (!category.name) {
      errors.push("Existe uma categoria sem nome.");
    }
  }

  for (const channel of template.channels || []) {
    if (!channel.name) {
      errors.push("Existe um canal sem nome.");
    }

    if (!channel.type) {
      errors.push(
        `O canal "${channel.name || "sem nome"}" não possui tipo.`
      );
    }

    if (
      channel.type &&
      !SUPPORTED_CHANNEL_TYPES[channel.type]
    ) {
      errors.push(
        `Tipo de canal inválido: ${channel.type}`
      );
    }
  }

  return errors;
}

/* =========================================================
   CARGOS
========================================================= */

async function createRoles(guild, template) {
  const roleMap = new Map();

  const roles = [...(template.roles || [])].sort(
    (a, b) => (a.position || 0) - (b.position || 0)
  );

  for (const data of roles) {
    const name = safeName(data.name);

    if (!name) continue;

    let role = guild.roles.cache.find(
      r => r.name === name
    );

    if (!role) {
      try {
        role = await guild.roles.create({
          name,
          color: safeColor(data.color) || undefined,
          hoist: Boolean(data.hoist),
          mentionable: Boolean(data.mentionable),
          permissions: permissionsToObject(
            data.permissions || []
          ),
          reason: "Template criado pelo bot"
        });
      } catch (error) {
        console.error(
          `Erro ao criar cargo "${name}":`,
          error.message
        );

        continue;
      }
    } else {
      // Atualiza as propriedades caso o cargo já exista.
      try {
        await role.edit({
          color: safeColor(data.color) || role.color,
          hoist: Boolean(data.hoist),
          mentionable: Boolean(data.mentionable),
          permissions: permissionsToObject(
            data.permissions || []
          ),
          reason: "Atualização pelo template"
        });
      } catch (error) {
        console.log(
          `Não foi possível atualizar "${name}": ${error.message}`
        );
      }
    }

    roleMap.set(name, role);
  }

  /*
   * Discord só permite movimentar cargos abaixo
   * do maior cargo do bot.
   */

  for (const data of roles) {
    const role = roleMap.get(safeName(data.name));

    if (!role) continue;

    if (typeof data.position !== "number") {
      continue;
    }

    try {
      await role.setPosition(data.position);
    } catch (error) {
      console.log(
        `Não foi possível posicionar "${role.name}": ${error.message}`
      );
    }
  }

  return roleMap;
}

/* =========================================================
   RESOLVER CARGO
========================================================= */

function resolveRole(guild, roleMap, roleName) {
  if (!roleName) return null;

  if (roleName === "@everyone") {
    return guild.roles.everyone;
  }

  return roleMap.get(roleName) || null;
}

/* =========================================================
   PERMISSÕES DE CANAL
========================================================= */

async function applyPermissionOverwrites(
  channel,
  overwrites,
  guild,
  roleMap
) {
  if (!Array.isArray(overwrites)) {
    return;
  }

  for (const overwrite of overwrites) {
    const role = resolveRole(
      guild,
      roleMap,
      overwrite.role
    );

    if (!role) {
      console.log(
        `⚠️ Cargo "${overwrite.role}" não encontrado para o canal "${channel.name}".`
      );

      continue;
    }

    const permissions =
      overwriteToObject(overwrite);

    try {
      await channel.permissionOverwrites.edit(
        role,
        permissions
      );
    } catch (error) {
      console.error(
        `Erro nas permissões de "${channel.name}":`,
        error.message
      );
    }
  }
}

/* =========================================================
   CATEGORIAS
========================================================= */

async function createCategories(
  guild,
  template,
  roleMap
) {
  const categoryMap = new Map();

  const categories = [
    ...(template.categories || [])
  ].sort(
    (a, b) =>
      (a.position || 0) -
      (b.position || 0)
  );

  for (const data of categories) {
    const name = safeName(data.name);

    if (!name) continue;

    let category = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === name
    );

    if (!category) {
      try {
        category = await guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          reason: "Template criado pelo bot"
        });
      } catch (error) {
        console.error(
          `Erro ao criar categoria "${name}":`,
          error.message
        );

        continue;
      }
    }

    categoryMap.set(name, category);

    await applyPermissionOverwrites(
      category,
      data.permissionOverwrites,
      guild,
      roleMap
    );
  }

  return categoryMap;
}

/* =========================================================
   CANAIS
========================================================= */

async function createChannels(
  guild,
  template,
  categoryMap,
  roleMap
) {
  const channels = [
    ...(template.channels || [])
  ].sort(
    (a, b) =>
      (a.position || 0) -
      (b.position || 0)
  );

  for (const data of channels) {
    const name = safeName(data.name);

    if (!name) continue;

    const type =
      SUPPORTED_CHANNEL_TYPES[data.type];

    if (!type) continue;

    const category =
      categoryMap.get(
        safeName(data.category)
      );

    let channel = guild.channels.cache.find(
      c =>
        c.name === name &&
        c.type === type
    );

    if (!channel) {
      try {
        const options = {
          name,
          type,
          reason: "Template criado pelo bot"
        };

        if (category) {
          options.parent = category.id;
        }

        if (
          data.type === "text" ||
          data.type === "announcement"
        ) {
          if (data.topic) {
            options.topic = String(
              data.topic
            ).slice(0, 1024);
          }

          options.nsfw =
            Boolean(data.nsfw);
        }

        channel =
          await guild.channels.create(options);
      } catch (error) {
        console.error(
          `Erro ao criar canal "${name}":`,
          error.message
        );

        continue;
      }
    } else if (category) {
      // Garante que o canal fique na categoria correta.
      try {
        await channel.setParent(
          category.id,
          {
            lockPermissions: false
          }
        );
      } catch (error) {
        console.log(
          `Não foi possível mover "${name}": ${error.message}`
        );
      }
    }

    await applyPermissionOverwrites(
      channel,
      data.permissionOverwrites,
      guild,
      roleMap
    );

    if (typeof data.position === "number") {
      try {
        await channel.setPosition(
          data.position
        );
      } catch (error) {
        console.log(
          `Não foi possível posicionar "${name}": ${error.message}`
        );
      }
    }
  }
}

/* =========================================================
   APLICAR TEMPLATE
========================================================= */

async function applyTemplate(
  guild,
  template
) {
  const errors =
    validateTemplate(template);

  if (errors.length > 0) {
    throw new Error(
      errors.join("\n")
    );
  }

  const roleMap =
    await createRoles(
      guild,
      template
    );

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
}

/* =========================================================
   STATUS REAL DO SERVIDOR
========================================================= */

function getServerStats(guild) {
  const totalChannels =
    guild.channels.cache.filter(
      channel =>
        channel.type !==
        ChannelType.GuildCategory
    ).size;

  const totalCategories =
    guild.channels.cache.filter(
      channel =>
        channel.type ===
        ChannelType.GuildCategory
    ).size;

  // @everyone não é contado como cargo personalizado.
  const totalRoles =
    guild.roles.cache.filter(
      role => role.id !== guild.id
    ).size;

  const totalMembers =
    guild.memberCount;

  return {
    channels: totalChannels,
    categories: totalCategories,
    roles: totalRoles,
    members: totalMembers
  };
}

/* =========================================================
   PROMPT PEQUENO
========================================================= */

const PROMPT_IA = `Crie um JSON de configuração para um servidor Discord.

O JSON deve conter:
- roles
- categories
- channels

Para cargos, use:
name, color, permissions, position.

Para canais, use:
name, type, category, position e permissionOverwrites.

Tipos:
text, voice, announcement, forum, stage.

Para permissões:
Administrator, ManageGuild, ManageChannels, ManageRoles,
ManageMessages, KickMembers, BanMembers, ModerateMembers,
ViewChannel, SendMessages, ReadMessageHistory, Connect, Speak.

Responda SOMENTE com JSON válido, sem explicações e sem markdown.

Exemplo de cargo administrador:
{
  "name": "Admin",
  "permissions": ["Administrator"]
}`;

/* =========================================================
   MODELO JSON PEQUENO
========================================================= */

const MODELO_JSON = {
  server: {
    name: "Meu Servidor"
  },
  roles: [
    {
      name: "Admin",
      color: "#5865F2",
      permissions: [
        "Administrator"
      ],
      position: 10
    },
    {
      name: "Membro",
      color: "#FFFFFF",
      permissions: [
        "ViewChannel",
        "SendMessages"
      ],
      position: 1
    }
  ],
  categories: [
    {
      name: "COMUNIDADE",
      position: 1
    }
  ],
  channels: [
    {
      name: "chat-geral",
      type: "text",
      category: "COMUNIDADE",
      position: 1
    }
  ]
};

/* =========================================================
   TUTORIAL
========================================================= */

async function sendTutorial(
  interaction
) {
  await interaction.reply({
    ephemeral: true,
    content:
      "📖 **Tutorial rápido**\n\n" +
      "1️⃣ Toque em **Prompt IA**.\n" +
      "2️⃣ Envie o prompt para uma IA e diga como quer seu servidor.\n" +
      "3️⃣ Salve a resposta da IA em `.json`.\n" +
      "4️⃣ Toque em **Gerar Template** e envie o arquivo.\n" +
      "5️⃣ O bot cria cargos, categorias, canais e permissões.\n\n" +
      "⚠️ O Discord ainda respeita a hierarquia de cargos."
  });
}

/* =========================================================
   ESPERAR JSON
========================================================= */

async function waitForJSON(
  interaction
) {
  const channel =
    interaction.channel;

  if (!channel) {
    throw new Error(
      "Canal não encontrado."
    );
  }

  await interaction.editReply({
    content:
      "📎 **Envie agora o arquivo `.json` neste canal.**\n\n" +
      "Você tem 2 minutos."
  });

  const filter = message => {
    if (
      message.author.id !==
      interaction.user.id
    ) {
      return false;
    }

    return message.attachments.some(
      attachment =>
        attachment.name &&
        attachment.name
          .toLowerCase()
          .endsWith(".json")
    );
  };

  let collected;

  try {
    collected =
      await channel.awaitMessages({
        filter,
        max: 1,
        time: 120000,
        errors: ["time"]
      });
  } catch {
    throw new Error(
      "Tempo esgotado. O arquivo JSON não foi enviado."
    );
  }

  const message =
    collected.first();

  if (!message) {
    throw new Error(
      "Arquivo não encontrado."
    );
  }

  const attachment =
    message.attachments.find(
      file =>
        file.name &&
        file.name
          .toLowerCase()
          .endsWith(".json")
    );

  if (!attachment) {
    throw new Error(
      "Envie um arquivo terminado em .json."
    );
  }

  let response;

  try {
    response =
      await fetch(attachment.url);
  } catch {
    throw new Error(
      "Não consegui acessar o arquivo enviado."
    );
  }

  if (!response.ok) {
    throw new Error(
      "Não consegui baixar o arquivo JSON."
    );
  }

  const raw =
    await response.text();

  let json;

  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      "Esse arquivo não possui JSON válido."
    );
  }

  /*
   * Tenta apagar o arquivo enviado para não
   * deixar lixo no canal.
   */

  try {
    await message.delete();
  } catch {}

  return json;
}

/* =========================================================
   READY
========================================================= */

client.once(
  Events.ClientReady,
  async readyClient => {
    console.log(
      `✅ Bot online: ${readyClient.user.tag}`
    );

    try {
      /*
       * Apaga comandos globais antigos.
       */
      await readyClient.application.commands.set(
        []
      );

      /*
       * Em cada servidor, deixa SOMENTE /painel.
       */
      for (const guild of readyClient.guilds.cache.values()) {
        try {
          await guild.commands.set([
            painelCommand
          ]);

          console.log(
            `✅ /painel registrado em ${guild.name}`
          );
        } catch (error) {
          console.error(
            `Erro ao registrar comandos em ${guild.name}:`,
            error.message
          );
        }
      }

      console.log(
        "✅ Comandos antigos removidos."
      );

    } catch (error) {
      console.error(
        "Erro ao configurar comandos:",
        error
      );
    }
  }
);

/* =========================================================
   INTERAÇÕES
========================================================= */

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {

      /* =====================================================
         SLASH COMMAND
      ===================================================== */

      if (
        interaction.isChatInputCommand()
      ) {

        if (!interaction.guild) {
          await interaction.reply({
            content:
              "❌ Use esse comando dentro de um servidor.",
            ephemeral: true
          });

          return;
        }

        /*
         * Segunda camada de segurança.
         */
        if (
          !isAdmin(
            interaction.member
          )
        ) {
          await interaction.reply({
            content:
              "❌ Apenas administradores do servidor podem usar este comando.",
            ephemeral: true
          });

          return;
        }

        if (
          interaction.commandName ===
          "painel"
        ) {

          /*
           * IMPORTANTE:
           * ephemeral = true
           *
           * Somente quem usou /painel verá.
           */

          await interaction.reply({
            ephemeral: true,
            content:
              "## 🤖 Gerenciador de Templates\n\n" +
              "Escolha uma opção abaixo:",
            components:
              createPanel()
          });

          return;
        }

        return;
      }

      /* =====================================================
         BOTÕES
      ===================================================== */

      if (
        interaction.isButton()
      ) {

        if (!interaction.guild) {
          await interaction.reply({
            content:
              "❌ Esse botão só funciona dentro de um servidor.",
            ephemeral: true
          });

          return;
        }

        /*
         * Todos os botões também exigem administrador.
         */

        if (
          !isAdmin(
            interaction.member
          )
        ) {
          await interaction.reply({
            content:
              "❌ Apenas administradores podem usar o painel.",
            ephemeral: true
          });

          return;
        }

        /* ===================================================
           PROMPT IA
        =================================================== */

        if (
          interaction.customId ===
          "prompt_ia"
        ) {

          await interaction.reply({
            ephemeral: true,
            content:
              "✨ **PROMPT PARA IA**\n\n" +
              "Copie este texto e envie para a IA:\n\n" +
              "```text\n" +
              PROMPT_IA +
              "\n```"
          });

          return;
        }

        /* ===================================================
           MODELO JSON
        =================================================== */

        if (
          interaction.customId ===
          "modelo_json"
        ) {

          const model =
            JSON.stringify(
              MODELO_JSON,
              null,
              2
            );

          await interaction.reply({
            ephemeral: true,
            content:
              "📋 **MODELO JSON**\n\n" +
              "Copie este exemplo e altere como quiser:\n\n" +
              "```json\n" +
              model +
              "\n```"
          });

          return;
        }

        /* ===================================================
           TUTORIAL
        =================================================== */

        if (
          interaction.customId ===
          "tutorial"
        ) {

          await sendTutorial(
            interaction
          );

          return;
        }

        /* ===================================================
           STATUS
        =================================================== */

        if (
          interaction.customId ===
          "status"
        ) {

          const stats =
            getServerStats(
              interaction.guild
            );

          await interaction.reply({
            ephemeral: true,
            content:
              "📊 **STATUS DO SERVIDOR**\n\n" +
              `👥 Membros: **${stats.members}**\n` +
              `🎭 Cargos: **${stats.roles}**\n` +
              `📁 Categorias: **${stats.categories}**\n` +
              `💬 Canais: **${stats.channels}**\n\n` +
              `🏠 Servidor: **${interaction.guild.name}**\n` +
              `⚡ Ping do bot: **${client.ws.ping}ms**`
          });

          return;
        }

        /* ===================================================
           ADMINISTRAR
        =================================================== */

        if (
          interaction.customId ===
          "administrar"
        ) {

          const me =
            interaction.guild.members.me;

          const highestRole =
            me?.roles?.highest;

          await interaction.reply({
            ephemeral: true,
            content:
              "⚙️ **ADMINISTRAÇÃO**\n\n" +
              "🔐 Painel: somente administradores\n" +
              "🛡️ Permissões: controladas pelo JSON\n" +
              `👑 Maior cargo do bot: **${highestRole?.name || "Desconhecido"}**\n\n` +
              "O Discord impede o bot de gerenciar cargos que estejam acima do maior cargo dele."
          });

          return;
        }

        /* ===================================================
           GERAR TEMPLATE
        =================================================== */

        if (
          interaction.customId ===
          "gerar_template"
        ) {

          await interaction.reply({
            ephemeral: true,
            content:
              "🚀 **Gerar Template**\n\n" +
              "Envie o arquivo `.json` neste canal."
          });

          try {

            const template =
              await waitForJSON(
                interaction
              );

            const errors =
              validateTemplate(
                template
              );

            if (
              errors.length > 0
            ) {

              await interaction.editReply({
                content:
                  "❌ **JSON inválido**\n\n" +
                  errors
                    .map(
                      e => `• ${e}`
                    )
                    .join("\n")
                    .slice(
                      0,
                      1800
                    )
              });

              return;
            }

            await interaction.editReply({
              content:
                "⚙️ **JSON válido!**\n\n" +
                "Criando cargos, categorias, canais e permissões..."
            });

            await applyTemplate(
              interaction.guild,
              template
            );

            /*
             * Lê os números DEPOIS da criação.
             * Portanto os números são do servidor real.
             */

            const stats =
              getServerStats(
                interaction.guild
              );

            await interaction.editReply({
              content:
                "✅ **Template criado com sucesso!**\n\n" +
                `👥 Membros no servidor: **${stats.members}**\n` +
                `🎭 Cargos: **${stats.roles}**\n` +
                `📁 Categorias: **${stats.categories}**\n` +
                `💬 Canais: **${stats.channels}**\n\n` +
                "⚠️ A hierarquia do Discord continua sendo respeitada."
            });

          } catch (error) {

            console.error(
              "❌ Erro ao gerar template:",
              error
            );

            await interaction.editReply({
              content:
                "❌ **Não foi possível criar o template.**\n\n" +
                String(
                  error.message ||
                  error
                ).slice(
                  0,
                  1800
                )
            });

          }

          return;
        }
      }

    } catch (error) {

      console.error(
        "❌ Erro geral:",
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
