const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  PermissionsBitField,
  ChannelType,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  MessageFlags
} = require('discord.js');

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ TOKEN não configurado no Render.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const P = PermissionFlagsBits;
const PREVIEW_TTL = 15 * 60 * 1000;
const MAX_ITEMS = 100;

// ============================================================
// ESTADO TEMPORÁRIO DO CONSTRUTOR
// ============================================================

const builders = new Map();

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function newBuilder() {
  return {
    createdAt: Date.now(),
    personalize: true,
    cleanFirst: false,
    roles: [],
    categories: [],
    channels: [],
    editingChannel: null
  };
}

function getBuilder(guildId, userId) {
  const k = key(guildId, userId);
  let state = builders.get(k);

  if (!state || Date.now() - state.createdAt > PREVIEW_TTL) {
    state = newBuilder();
    builders.set(k, state);
  }

  return state;
}

function saveBuilder(guildId, userId, state) {
  state.createdAt = Date.now();
  builders.set(key(guildId, userId), state);
}

function clearBuilder(guildId, userId) {
  builders.delete(key(guildId, userId));
}

setInterval(() => {
  const now = Date.now();

  for (const [k, state] of builders) {
    if (now - state.createdAt > PREVIEW_TTL) {
      builders.delete(k);
    }
  }
}, 60_000).unref();

// ============================================================
// PERMISSÕES / NÍVEIS
// ============================================================

const PERMISSION_NAMES = {
  Administrator: 'Administrador',
  ManageGuild: 'Gerenciar servidor',
  ManageChannels: 'Gerenciar canais',
  ManageRoles: 'Gerenciar cargos',
  ManageMessages: 'Gerenciar mensagens',
  KickMembers: 'Expulsar membros',
  BanMembers: 'Banir membros',
  ModerateMembers: 'Moderar membros',
  ViewChannel: 'Ver canais',
  SendMessages: 'Enviar mensagens',
  ReadMessageHistory: 'Ler histórico',
  Connect: 'Conectar',
  Speak: 'Falar',
  MentionEveryone: 'Mencionar @everyone',
  AttachFiles: 'Anexar arquivos',
  EmbedLinks: 'Inserir links',
  AddReactions: 'Adicionar reações',
  UseExternalEmojis: 'Usar emojis externos',
  CreateInstantInvite: 'Criar convite',
  ManageWebhooks: 'Gerenciar webhooks',
  ManageNicknames: 'Gerenciar apelidos',
  ChangeNickname: 'Alterar apelido',
  SendMessagesInThreads: 'Enviar em threads',
  CreatePublicThreads: 'Criar threads públicas',
  CreatePrivateThreads: 'Criar threads privadas',
  UseApplicationCommands: 'Usar comandos de aplicativos',
  UseEmbeddedActivities: 'Usar atividades'
};

const PERMISSIONS = Object.fromEntries(
  Object.keys(PERMISSION_NAMES).map(name => [
    name,
    P[name]
  ])
);

const ALIASES = {
  administrador: 'Administrator',
  admin: 'Administrator',
  dono: 'Administrator',
  owner: 'Administrator',

  'todas as permissões': 'Administrator',
  'todas permissoes': 'Administrator',

  'gerenciar servidor': 'ManageGuild',
  'gerenciar canais': 'ManageChannels',
  'gerenciar cargos': 'ManageRoles',
  'gerenciar mensagens': 'ManageMessages',

  'expulsar membros': 'KickMembers',
  expulsar: 'KickMembers',
  kick: 'KickMembers',

  banir: 'BanMembers',
  ban: 'BanMembers',

  moderar: 'ModerateMembers',
  timeout: 'ModerateMembers',

  'ver canais': 'ViewChannel',
  visualizar: 'ViewChannel',

  'enviar mensagens': 'SendMessages',
  escrever: 'SendMessages',

  'ler histórico': 'ReadMessageHistory',
  'ler historico': 'ReadMessageHistory',

  conectar: 'Connect',
  falar: 'Speak',

  'anexar arquivos': 'AttachFiles',
  'inserir links': 'EmbedLinks',

  reações: 'AddReactions',
  reacoes: 'AddReactions',

  'criar convite': 'CreateInstantInvite',

  'gerenciar webhooks': 'ManageWebhooks',
  'gerenciar apelidos': 'ManageNicknames',
  'alterar apelido': 'ChangeNickname'
};

const LEVELS = {
  1: {
    name: 'Membro',
    permissions: [
      'ViewChannel',
      'SendMessages',
      'ReadMessageHistory',
      'Connect',
      'Speak',
      'AddReactions'
    ]
  },

  2: {
    name: 'Ajudante',
    permissions: [
      'ViewChannel',
      'SendMessages',
      'ReadMessageHistory',
      'Connect',
      'Speak',
      'AddReactions',
      'ManageMessages'
    ]
  },

  3: {
    name: 'Moderador',
    permissions: [
      'ViewChannel',
      'SendMessages',
      'ReadMessageHistory',
      'Connect',
      'Speak',
      'AddReactions',
      'ManageMessages',
      'KickMembers',
      'ModerateMembers'
    ]
  },

  4: {
    name: 'Administrador',
    permissions: [
      'ViewChannel',
      'SendMessages',
      'ReadMessageHistory',
      'Connect',
      'Speak',
      'AddReactions',
      'ManageMessages',
      'ManageChannels',
      'ManageRoles',
      'ManageGuild',
      'KickMembers',
      'ModerateMembers'
    ]
  },

  5: {
    name: 'Dono',
    permissions: [
      'Administrator'
    ]
  }
};

function normalize(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cleanName(
  text,
  fallback = 'sem-nome'
) {
  return String(text || fallback)
    .trim()
    .slice(0, 100);
}

function parseLevel(value) {
  const n = Number(
    String(value).match(/[1-5]/)?.[0]
  );

  return n >= 1 && n <= 5
    ? n
    : null;
}

function parsePermissionText(
  text = '',
  level = null
) {
  const normalized = normalize(text);

  let permissionSet = new Set();

  if (level && LEVELS[level]) {
    for (const permission of LEVELS[level].permissions) {
      permissionSet.add(permission);
    }
  }

  const allRequested =
    /(todas|todos).*(permiss|permissao)/.test(normalized) ||
    normalized === 'todas';

  if (allRequested) {
    permissionSet = new Set(
      Object.keys(PERMISSIONS)
    );
  }

  for (const [alias, permission] of Object.entries(ALIASES)) {
    if (normalized.includes(alias)) {
      permissionSet.add(permission);
    }
  }

  if (allRequested) {
    for (const [alias, permission] of Object.entries(ALIASES)) {
      if (
        normalized.includes(`menos ${alias}`) ||
        normalized.includes(`exceto ${alias}`) ||
        normalized.includes(`sem ${alias}`)
      ) {
        permissionSet.delete(permission);
      }
    }
  }

  if (permissionSet.has('Administrator')) {
    permissionSet = new Set([
      'Administrator'
    ]);
  }

  return [
    ...permissionSet
  ];
}

function permissionsForLevel(
  level,
  description = ''
) {
  return parsePermissionText(
    description,
    level
  );
}

function hexToInt(color) {
  if (!color) return null;

  const value = String(color)
    .trim()
    .replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return parseInt(value, 16);
}

function unique(arr) {
  return [
    ...new Set(arr)
  ];
}

function roleByName(
  guild,
  name
) {
  const target = normalize(name);

  return guild.roles.cache.find(
    role =>
      normalize(role.name) === target
  );
}

function categoryByName(
  guild,
  name
) {
  const target = normalize(name);

  return guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      normalize(channel.name) === target
  );
}

function channelByNameAndType(
  guild,
  name,
  type
) {
  const target = normalize(name);

  return guild.channels.cache.find(
    channel =>
      channel.type === type &&
      normalize(channel.name) === target
  );
}

// ============================================================
// SEGURANÇA
// ============================================================

function isAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(
      P.Administrator
    ) ||
    interaction.memberPermissions?.has(
      P.ManageGuild
    )
  );
}

async function requireAdmin(interaction) {
  if (isAdmin(interaction)) {
    return true;
  }

  const payload = {
    content:
      '❌ Apenas administradores podem usar este painel.',
    flags: MessageFlags.Ephemeral
  };

  if (
    interaction.replied ||
    interaction.deferred
  ) {
    await interaction
      .followUp(payload)
      .catch(() => {});
  } else {
    await interaction
      .reply(payload)
      .catch(() => {});
  }

  return false;
}

function ephemeralPayload(data = {}) {
  return {
    ...data,
    flags: MessageFlags.Ephemeral
  };
}

// ============================================================
// EMBEDS / PAINÉIS
// ============================================================

function panelEmbed(
  guild,
  state
) {
  const roles = state.roles.length
    ? state.roles
        .map(
          role =>
            `• **${role.name}** — nível ${role.level}`
        )
        .join('\n')
    : 'Nenhum cargo configurado.';

  const categories = state.categories.length
    ? state.categories
        .map(
          category =>
            `• **${category.name}** — ${
              category.private
                ? '🔒 privado'
                : '🌎 público'
            }`
        )
        .join('\n')
    : 'Nenhuma categoria configurada.';

  const channels = state.channels.length
    ? state.channels
        .map(channel => {
          const icon =
            channel.type === 'voice'
              ? '🔊'
              : channel.type === 'announcement'
                ? '📢'
                : '💬';

          return (
            `• ${icon} **${channel.name}**` +
            (
              channel.category
                ? ` → ${channel.category}`
                : ''
            )
          );
        })
        .join('\n')
    : 'Nenhum canal configurado.';

  return new EmbedBuilder()
    .setTitle(
      '🛠️ Construtor de Servidor'
    )
    .setDescription(
      'Configure o servidor por partes. **Você não precisa escrever um prompt gigante.**\n\n' +
      'A IA é opcional: ela serve para sugerir uma configuração, enquanto o painel manual permite controlar exatamente cargos, canais e permissões.'
    )
    .addFields(
      {
        name:
          `👑 Cargos (${state.roles.length})`,
        value:
          roles.slice(0, 1024)
      },
      {
        name:
          `📁 Categorias (${state.categories.length})`,
        value:
          categories.slice(0, 1024)
      },
      {
        name:
          `💬 Canais (${state.channels.length})`,
        value:
          channels.slice(0, 1024)
      },
      {
        name: '✨ Personalização',
        value:
          state.personalize
            ? 'Ativada'
            : 'Desativada',
        inline: true
      },
      {
        name:
          '🧹 Limpar estrutura atual',
        value:
          state.cleanFirst
            ? 'Sim'
            : 'Não',
        inline: true
      }
    )
    .setFooter({
      text:
        `${guild.name} • rascunho temporário`
    });
}

function panelRows() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'builder_role_new'
          )
          .setLabel(
            'Novo cargo'
          )
          .setEmoji('👑')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'builder_category_new'
          )
          .setLabel(
            'Nova categoria'
          )
          .setEmoji('📁')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            'builder_channel_new'
          )
          .setLabel(
            'Novo canal'
          )
          .setEmoji('💬')
          .setStyle(
            ButtonStyle.Primary
          )
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'builder_personalize'
          )
          .setLabel(
            'Personalização'
          )
          .setEmoji('✨')
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'builder_clean'
          )
          .setLabel(
            'Limpeza'
          )
          .setEmoji('🧹')
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'builder_ai'
          )
          .setLabel(
            'Assistente'
          )
          .setEmoji('🧠')
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'builder_preview'
          )
          .setLabel(
            'Prévia'
          )
          .setEmoji('👁️')
          .setStyle(
            ButtonStyle.Secondary
          )
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'builder_create'
          )
          .setLabel(
            'Criar servidor'
          )
          .setEmoji('🚀')
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            'builder_cancel'
          )
          .setLabel(
            'Cancelar'
          )
          .setEmoji('✖️')
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

async function showBuilder(
  interaction,
  state
) {
  return interaction.editReply({
    embeds: [
      panelEmbed(
        interaction.guild,
        state
      )
    ],
    components:
      panelRows()
  });
}

// ============================================================
// MODAIS
// ============================================================

function modalText(
  id,
  label,
  placeholder,
  value = '',
  required = true,
  maxLength = 100
) {
  return new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(
      TextInputStyle.Short
    )
    .setPlaceholder(
      placeholder
    )
    .setRequired(
      required
    )
    .setMaxLength(
      maxLength
    )
    .setValue(
      String(value || '')
        .slice(0, maxLength)
    );
}

function modalParagraph(
  id,
  label,
  placeholder,
  value = '',
  required = false,
  maxLength = 1000
) {
  return new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(
      TextInputStyle.Paragraph
    )
    .setPlaceholder(
      placeholder
    )
    .setRequired(
      required
    )
    .setMaxLength(
      maxLength
    )
    .setValue(
      String(value || '')
        .slice(0, maxLength)
    );
}

function roleModal() {
  return new ModalBuilder()
    .setCustomId(
      'modal_role'
    )
    .setTitle(
      '👑 Novo cargo'
    )
    .addComponents(
      new ActionRowBuilder()
        .addComponents(
          modalText(
            'name',
            'Nome do cargo',
            'Ex.: Dono'
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          modalText(
            'level',
            'Nível (1 a 5)',
            'Ex.: 4'
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          modalParagraph(
            'permissions',
            'Permissões / exceções',
            'Ex.: todas as permissões menos banir'
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          modalText(
            'color',
            'Cor opcional',
            'Ex.: #5865F2',
            '',
            false,
            7
          )
        )
    );
}

function categoryModal() {
  return new ModalBuilder()
    .setCustomId(
      'modal_category'
    )
    .setTitle(
      '📁 Nova categoria'
    )
    .addComponents(
      new ActionRowBuilder()
        .addComponents(
          modalText(
            'name',
            'Nome da categoria',
            'Ex.: STAFF'
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          modalText(
            'visibility',
            'Visibilidade',
            'publico ou privado'
          )
        )
    );
}

function channelModal(state) {
  const defaultCategory =
    state.categories[0]?.name ||
    '';

  return new ModalBuilder()
    .setCustomId(
      'modal_channel'
    )
    .setTitle(
      '💬 Novo canal'
    )
    .addComponents(
      new ActionRowBuilder()
        .addComponents(
          modalText(
            'name',
            'Nome do canal',
            'Ex.: avisos-staff'
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          modalText(
            'type',
            'Tipo',
            'texto, voz ou anuncios'
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          modalText(
            'category',
            'Categoria (opcional)',
            'Ex.: STAFF',
            defaultCategory,
            false
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          modalText(
            'personalize',
            'Personalizar?',
            'sim ou nao',
            state.personalize
              ? 'sim'
              : 'nao',
            false,
            3
          )
        )
    );
}

function aiModal() {
  return new ModalBuilder()
    .setCustomId(
      'modal_ai'
    )
    .setTitle(
      '🧠 Assistente de configuração'
    )
    .addComponents(
      new ActionRowBuilder()
        .addComponents(
          modalParagraph(
            'description',
            'Descreva uma coisa por vez',
            'Ex.: cria uma call chamada Alta Cúpula, privada, só Admin entra',
            '',
            true,
            1500
          )
        )
    );
}

// ============================================================
// PERSONALIZAÇÃO
// ============================================================

function personalizeChannelName(
  name,
  type,
  enabled
) {
  if (!enabled) {
    return cleanName(name);
  }

  const raw = cleanName(name);

  if (
    /^[\p{Extended_Pictographic}]/u
      .test(raw)
  ) {
    return raw;
  }

  if (type === 'voice') {
    return `🔊・${raw}`.slice(
      0,
      100
    );
  }

  if (type === 'announcement') {
    return `📢・${raw}`.slice(
      0,
      100
    );
  }

  return `💬・${raw}`.slice(
    0,
    100
  );
}

// ============================================================
// ASSISTENTE CONTROLADO
// ============================================================

function interpretSingleRequest(
  text,
  state
) {
  const n = normalize(text);

  // ----------------------------------------------------------
  // CARGO
  // ----------------------------------------------------------

  if (
    /(cargo|role)/.test(n)
  ) {
    const match =
      text.match(
        /(?:cargo|role)\s+(?:chamado|nome)?\s*[:=-]?\s*([\p{L}\p{N} _-]{2,60})/iu
      );

    const name =
      match?.[1]?.trim() ||
      text
        .replace(
          /.*?(?:cargo|role)/iu,
          ''
        )
        .trim()
        .slice(
          0,
          60
        ) ||
      'Novo cargo';

    const level =
      parseLevel(text) ||
      1;

    const permissions =
      permissionsForLevel(
        level,
        text
      );

    const colorMatch =
      text.match(
        /#[0-9a-fA-F]{6}/
      );

    state.roles.push({
      name:
        cleanName(name),
      level,
      permissions,
      color:
        colorMatch
          ? colorMatch[0]
          : null
    });

    return (
      `👑 Cargo **${cleanName(name)}** adicionado no nível ${level}.`
    );
  }

  // ----------------------------------------------------------
  // CANAL
  // ----------------------------------------------------------

  if (
    /(canal|call|chat|sala)/.test(n)
  ) {
    const voice =
      /(call|voz|voice)/.test(n);

    const announcement =
      /(aviso|anuncio|announcements?)/.test(n);

    let name = null;

    const named =
      text.match(
        /(?:chamado|nome)\s+["“]?([^"”]+?)["”]?(?:,|\.|$)/iu
      );

    if (named?.[1]) {
      name =
        named[1].trim();
    }

    if (!name) {
      const after =
        text.match(
          /(?:canal|call|chat|sala)\s+(?:de\s+)?(.+)/iu
        );

      name =
        after?.[1]
          ?.split(',')[0]
          ?.trim() ||
        'novo-canal';
    }

    let category = null;

    const cat =
      text.match(
        /categoria\s+([\p{L}\p{N} _-]+)/iu
      );

    if (cat?.[1]) {
      category =
        cat[1].trim();
    }

    const privateChannel =
      /(privad[oa]|so admin|só admin|somente admin)/.test(n);

    const readonly =
      /(somente leitura|so leitura|só leitura|ninguem pode enviar|ninguém pode enviar)/.test(n);

    const personalize =
      !/(sem personaliza|nao personaliza|não personaliza)/.test(n);

    state.channels.push({
      name:
        cleanName(name),

      type:
        voice
          ? 'voice'
          : announcement
            ? 'announcement'
            : 'text',

      category,

      personalize,

      private:
        privateChannel,

      readonly,

      denyViewRoles: [],

      denySendRoles: []
    });

    return (
      `💬 Canal **${cleanName(name)}** adicionado. Agora você pode abrir a configuração dele e escolher exatamente quais cargos não podem ver ou enviar mensagens.`
    );
  }

  return (
    '⚠️ Não adicionei nada automaticamente. Para evitar erros, use o painel **Novo cargo**, **Nova categoria** ou **Novo canal** e configure manualmente.'
  );
}

// ============================================================
// PERMISSÕES DE CATEGORIA / CANAL
// ============================================================

function overwrite(
  id,
  allow = [],
  deny = []
) {
  return {
    id,
    allow:
      unique(allow),
    deny:
      unique(deny)
  };
}

function buildCategoryOverwrites(
  guild,
  categoryConfig,
  roleMap
) {
  const overwrites = [];

  if (
    categoryConfig.private
  ) {
    overwrites.push(
      overwrite(
        guild.roles.everyone.id,
        [],
        [P.ViewChannel]
      )
    );

    for (
      const role of roleMap.values()
    ) {
      if (
        role.permissions.has(
          P.Administrator
        ) ||
        role.permissions.has(
          P.ManageGuild
        )
      ) {
        overwrites.push(
          overwrite(
            role.id,
            [P.ViewChannel]
          )
        );
      }
    }
  } else {
    overwrites.push(
      overwrite(
        guild.roles.everyone.id,
        [P.ViewChannel]
      )
    );
  }

  return overwrites;
}

function buildChannelOverwrites(
  guild,
  config,
  roleMap
) {
  const overwrites = [];

  const denyView =
    new Set(
      config.denyViewRoles || []
    );

  const denySend =
    new Set(
      config.denySendRoles || []
    );

  const everyoneDeny = [];

  const everyoneAllow = [
    P.ViewChannel
  ];

  if (
    config.private
  ) {
    everyoneDeny.push(
      P.ViewChannel
    );
  }

  if (
    config.readonly &&
    config.type !== 'voice'
  ) {
    everyoneDeny.push(
      P.SendMessages
    );
  }

  overwrites.push(
    overwrite(
      guild.roles.everyone.id,
      everyoneAllow,
      everyoneDeny
    )
  );

  for (
    const roleName of denyView
  ) {
    const role =
      roleMap.get(
        normalize(roleName)
      );

    if (role) {
      overwrites.push(
        overwrite(
          role.id,
          [],
          [P.ViewChannel]
        )
      );
    }
  }

  for (
    const roleName of denySend
  ) {
    const role =
      roleMap.get(
        normalize(roleName)
      );

    if (role) {
      overwrites.push(
        overwrite(
          role.id,
          [P.ViewChannel],
          [P.SendMessages]
        )
      );
    }
  }

  return overwrites;
}

// ============================================================
// DISCORD: APLICAÇÃO
// ============================================================

async function ensureBotPermissions(
  guild
) {
  const me =
    guild.members.me ||
    await guild.members.fetchMe();

  const required = [
    P.ManageChannels,
    P.ManageRoles
  ];

  const missing =
    required.filter(
      permission =>
        !me.permissions.has(
          permission
        )
    );

  if (missing.length) {
    throw new Error(
      'O bot precisa de **Gerenciar Canais** e **Gerenciar Cargos**.'
    );
  }

  return me;
}

async function cleanupGuildStructure(
  guild
) {
  const channels =
    [
      ...guild.channels.cache.values()
    ];

  for (
    const channel of channels
  ) {
    try {
      await channel.delete(
        'Limpeza solicitada pelo construtor de servidor'
      );
    } catch (error) {
      console.warn(
        `⚠️ Não consegui excluir canal ${channel.name}: ${error.message}`
      );
    }
  }
}

async function applyRoles(
  guild,
  state
) {
  const roleMap =
    new Map();

  const sorted =
    [...state.roles]
      .sort(
        (a, b) =>
          a.level - b.level
      );

  for (
    const config of sorted
  ) {
    let role =
      roleByName(
        guild,
        config.name
      );

    const permissions =
      new PermissionsBitField(
        config.permissions || []
      );

    const edit = {
      permissions
    };

    const color =
      hexToInt(
        config.color
      );

    if (color !== null) {
      edit.color =
        color;
    }

    if (!role) {
      role =
        await guild.roles.create({
          name:
            cleanName(
              config.name
            ),

          permissions,

          color:
            color === null
              ? undefined
              : color,

          reason:
            'Construtor de servidor'
        });
    } else if (
      !role.managed
    ) {
      await role.edit(
        edit,
        'Atualização pelo construtor de servidor'
      );
    }

    roleMap.set(
      normalize(config.name),
      role
    );
  }

  const me =
    guild.members.me ||
    await guild.members.fetchMe();

  const positions = [];

  for (
    const config of sorted
  ) {
    const role =
      roleMap.get(
        normalize(
          config.name
        )
      );

    if (
      !role ||
      role.managed
    ) {
      continue;
    }

    if (
      role.position >=
      me.roles.highest.position
    ) {
      console.warn(
        `⚠️ Não posso mover o cargo ${role.name}: ele está acima ou no mesmo nível do maior cargo do bot.`
      );

      continue;
    }

    positions.push({
      role:
        role.id,

      position:
        Math.max(
          1,
          config.level
        )
    });
  }

  if (
    positions.length
  ) {
    await guild.roles
      .setPositions(
        positions
      )
      .catch(
        error => {
          console.warn(
            `⚠️ Não foi possível ajustar toda a hierarquia: ${error.message}`
          );
        }
      );
  }

  return roleMap;
}

async function applyCategories(
  guild,
  state,
  roleMap
) {
  const categoryMap =
    new Map();

  for (
    let i = 0;
    i < state.categories.length;
    i++
  ) {
    const config =
      state.categories[i];

    let category =
      categoryByName(
        guild,
        config.name
      );

    const overwrites =
      buildCategoryOverwrites(
        guild,
        config,
        roleMap
      );

    if (!category) {
      category =
        await guild.channels.create({
          name:
            cleanName(
              config.name
            ),

          type:
            ChannelType.GuildCategory,

          permissionOverwrites:
            overwrites,

          reason:
            'Construtor de servidor'
        });
    } else {
      await category.edit(
        {
          permissionOverwrites:
            overwrites,

          position:
            i
        },
        'Atualização pelo construtor de servidor'
      );
    }

    categoryMap.set(
      normalize(
        config.name
      ),
      category
    );
  }

  return categoryMap;
}

function discordChannelType(
  type
) {
  if (
    type === 'voice'
  ) {
    return ChannelType.GuildVoice;
  }

  if (
    type === 'announcement'
  ) {
    return ChannelType.GuildAnnouncement;
  }

  return ChannelType.GuildText;
}

async function applyChannels(
  guild,
  state,
  categoryMap,
  roleMap
) {
  for (
    let i = 0;
    i < state.channels.length;
    i++
  ) {
    const config =
      state.channels[i];

    const type =
      discordChannelType(
        config.type
      );

    const displayName =
      personalizeChannelName(
        config.name,
        config.type,
        config.personalize
      );

    const parent =
      config.category
        ? categoryMap.get(
            normalize(
              config.category
            )
          )
        : null;

    const overwrites =
      buildChannelOverwrites(
        guild,
        config,
        roleMap
      );

    let channel =
      channelByNameAndType(
        guild,
        displayName,
        type
      );

    const edit = {
      name:
        displayName,

      permissionOverwrites:
        overwrites,

      position:
        i,

      parent:
        parent?.id || null
    };

    if (!channel) {
      channel =
        await guild.channels.create({
          name:
            displayName,

          type,

          parent:
            parent?.id,

          permissionOverwrites:
            overwrites,

          reason:
            'Construtor de servidor'
        });
    } else {
      await channel.edit(
        edit,
        'Atualização pelo construtor de servidor'
      );
    }
  }
}

async function applyTemplate(
  guild,
  state
) {
  await ensureBotPermissions(
    guild
  );

  if (
    !state.roles.length &&
    !state.categories.length &&
    !state.channels.length
  ) {
    throw new Error(
      'O rascunho está vazio. Crie pelo menos um cargo, categoria ou canal.'
    );
  }

  if (
    state.cleanFirst
  ) {
    await cleanupGuildStructure(
      guild
    );
  }

  const roleMap =
    await applyRoles(
      guild,
      state
    );

  const categoryMap =
    await applyCategories(
      guild,
      state,
      roleMap
    );

  await applyChannels(
    guild,
    state,
    categoryMap,
    roleMap
  );
}

// ============================================================
// PRÉVIA
// ============================================================

function previewEmbed(
  state
) {
  const roleLines =
    state.roles.length
      ? state.roles
          .map(
            role =>
              `👑 **${role.name}** — nível ${role.level} — ${
                role.permissions.includes(
                  'Administrator'
                )
                  ? 'Administrator'
                  : `${role.permissions.length} permissões`
              }`
          )
          .join('\n')
      : 'Nenhum.';

  const categoryLines =
    state.categories.length
      ? state.categories
          .map(
            category =>
              `📁 **${category.name}** — ${
                category.private
                  ? '🔒 privado'
                  : '🌎 público'
              }`
          )
          .join('\n')
      : 'Nenhuma.';

  const channelLines =
    state.channels.length
      ? state.channels
          .map(channel => {
            const type =
              channel.type ===
              'voice'
                ? '🔊 voz'
                : channel.type ===
                  'announcement'
                  ? '📢 anúncios'
                  : '💬 texto';

            const view =
              channel.private ||
              channel.denyViewRoles?.length
                ? `não veem: ${
                    (
                      channel.denyViewRoles ||
                      []
                    ).join(', ') ||
                    'padrão'
                  }`
                : 'visibilidade padrão';

            const send =
              channel.readonly ||
              channel.denySendRoles?.length
                ? `não enviam: ${
                    (
                      channel.denySendRoles ||
                      []
                    ).join(', ') ||
                    'padrão'
                  }`
                : 'envio padrão';

            return (
              `${type} **${channel.name}**` +
              (
                channel.category
                  ? ` → ${channel.category}`
                  : ''
              ) +
              `\n↳ ${view} • ${send}`
            );
          })
          .join('\n\n')
      : 'Nenhum.';

  return new EmbedBuilder()
    .setTitle(
      '👁️ Prévia do servidor'
    )
    .setDescription(
      'Nada será alterado no servidor enquanto você não clicar em **🚀 Criar servidor**.'
    )
    .addFields(
      {
        name:
          '👑 CARGOS',
        value:
          roleLines.slice(
            0,
            1024
          )
      },

      {
        name:
          '📁 CATEGORIAS',
        value:
          categoryLines.slice(
            0,
            1024
          )
      },

      {
        name:
          '💬 CANAIS',
        value:
          channelLines.slice(
            0,
            1024
          )
      },

      {
        name:
          '🧹 Limpeza',
        value:
          state.cleanFirst
            ? 'ATIVADA — canais/categorias atuais serão excluídos.'
            : 'Desativada.'
      },

      {
        name:
          '✨ Personalização padrão',
        value:
          state.personalize
            ? 'Ativada'
            : 'Desativada'
      }
    );
}

// ============================================================
// CONFIGURAÇÃO DE CANAL
// ============================================================

function channelConfigEmbed(
  config
) {
  const view =
    config.denyViewRoles?.length
      ? config.denyViewRoles
          .map(
            role =>
              `• ${role}`
          )
          .join('\n')
      : 'Nenhum cargo bloqueado.';

  const send =
    config.denySendRoles?.length
      ? config.denySendRoles
          .map(
            role =>
              `• ${role}`
          )
          .join('\n')
      : 'Nenhum cargo bloqueado.';

  return new EmbedBuilder()
    .setTitle(
      `⚙️ Configurando: ${config.name}`
    )
    .setDescription(
      '**Somente os cargos listados aqui recebem bloqueios.**\n' +
      'Quem não estiver listado continua com a permissão normal.'
    )
    .addFields(
      {
        name:
          '👁️ NÃO PODEM VER',
        value:
          view.slice(
            0,
            1024
          )
      },

      {
        name:
          '✍️ NÃO PODEM ENVIAR',
        value:
          send.slice(
            0,
            1024
          )
      },

      {
        name:
          '📖 Somente leitura',
        value:
          config.readonly
            ? 'Ativado'
            : 'Desativado',
        inline: true
      },

      {
        name:
          '✨ Personalização',
        value:
          config.personalize
            ? 'Ativada'
            : 'Desativada',
        inline: true
      },

      {
        name:
          '📁 Categoria',
        value:
          config.category ||
          'Sem categoria',
        inline: true
      }
    );
}

function channelConfigRows() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(
            'channel_deny_view_select'
          )
          .setPlaceholder(
            'Selecionar cargos que NÃO podem ver'
          )
          .setMinValues(0)
          .setMaxValues(25)
      ),

    new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(
            'channel_deny_send_select'
          )
          .setPlaceholder(
            'Selecionar cargos que NÃO podem enviar'
          )
          .setMinValues(0)
          .setMaxValues(25)
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'channel_readonly'
          )
          .setLabel(
            'Somente leitura'
          )
          .setEmoji('📖')
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'channel_personalize'
          )
          .setLabel(
            'Personalização'
          )
          .setEmoji('✨')
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            'channel_clear_rules'
          )
          .setLabel(
            'Limpar bloqueios'
          )
          .setEmoji('🧹')
          .setStyle(
            ButtonStyle.Danger
          )
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'channel_save'
          )
          .setLabel(
            'Salvar canal'
          )
          .setEmoji('💾')
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            'channel_cancel'
          )
          .setLabel(
            'Cancelar'
          )
          .setEmoji('✖️')
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

async function showChannelConfig(
  interaction,
  config
) {
  return interaction.editReply({
    embeds: [
      channelConfigEmbed(
        config
      )
    ],
    components:
      channelConfigRows()
  });
}

// ============================================================
// STATUS
// ============================================================

function statusEmbed(
  guild
) {
  const roles =
    guild.roles.cache.filter(
      role =>
        !role.managed &&
        role.id !== guild.id
    ).size;

  const categories =
    guild.channels.cache.filter(
      channel =>
        channel.type ===
        ChannelType.GuildCategory
    ).size;

  const channels =
    guild.channels.cache.filter(
      channel =>
        channel.type !==
        ChannelType.GuildCategory
    ).size;

  return new EmbedBuilder()
    .setTitle(
      '📊 Status do servidor'
    )
    .addFields(
      {
        name:
          '👥 Membros',
        value:
          String(
            guild.memberCount
          ),
        inline: true
      },

      {
        name:
          '👑 Cargos',
        value:
          String(roles),
        inline: true
      },

      {
        name:
          '📁 Categorias',
        value:
          String(categories),
        inline: true
      },

      {
        name:
          '💬 Canais',
        value:
          String(channels),
        inline: true
      }
    );
}

// ============================================================
// COMANDO /PAINEL
// ============================================================

const painelCommand =
  new SlashCommandBuilder()
    .setName(
      'painel'
    )
    .setDescription(
      'Abrir o construtor de servidor'
    )
    .setDefaultMemberPermissions(
      P.Administrator.toString()
    );

async function openPanel(
  interaction
) {
  if (
    !await requireAdmin(
      interaction
    )
  ) {
    return;
  }

  const state =
    getBuilder(
      interaction.guild.id,
      interaction.user.id
    );

  await interaction.reply(
    ephemeralPayload({
      embeds: [
        panelEmbed(
          interaction.guild,
          state
        )
      ],
      components:
        panelRows()
    })
  );
}

// ============================================================
// INTERAÇÕES
// ============================================================

client.on(
  'interactionCreate',
  async interaction => {
    try {
      if (
        interaction.isChatInputCommand()
      ) {
        if (
          interaction.commandName ===
          'painel'
        ) {
          await openPanel(
            interaction
          );
        }

        return;
      }

      if (
        !interaction.guild
      ) {
        return;
      }

      if (
        !await requireAdmin(
          interaction
        )
      ) {
        return;
      }

      const state =
        getBuilder(
          interaction.guild.id,
          interaction.user.id
        );

      // ========================================================
      // BOTÕES
      // ========================================================

      if (
        interaction.isButton()
      ) {
        switch (
          interaction.customId
        ) {
          case 'builder_role_new':
            await interaction.showModal(
              roleModal()
            );
            return;

          case 'builder_category_new':
            await interaction.showModal(
              categoryModal()
            );
            return;

          case 'builder_channel_new':
            await interaction.showModal(
              channelModal(state)
            );
            return;

          case 'builder_personalize':
            state.personalize =
              !state.personalize;

            saveBuilder(
              interaction.guild.id,
              interaction.user.id,
              state
            );

            await showBuilder(
              interaction,
              state
            );

            return;

          case 'builder_clean':
            state.cleanFirst =
              !state.cleanFirst;

            saveBuilder(
              interaction.guild.id,
              interaction.user.id,
              state
            );

            await showBuilder(
              interaction,
              state
            );

            return;

          case 'builder_ai':
            await interaction.showModal(
              aiModal()
            );

            return;

          case 'builder_preview':
            await interaction.editReply({
              embeds: [
                previewEmbed(
                  state
                )
              ],

              components: [
                new ActionRowBuilder()
                  .addComponents(
                    new ButtonBuilder()
                      .setCustomId(
                        'builder_back'
                      )
                      .setLabel(
                        'Voltar'
                      )
                      .setEmoji('↩️')
                      .setStyle(
                        ButtonStyle.Secondary
                      ),

                    new ButtonBuilder()
                      .setCustomId(
                        'builder_create'
                      )
                      .setLabel(
                        'Criar servidor'
                      )
                      .setEmoji('🚀')
                      .setStyle(
                        ButtonStyle.Success
                      )
                  )
              ]
            });

            return;

          case 'builder_back':
            await showBuilder(
              interaction,
              state
            );

            return;

          case 'builder_cancel':
            clearBuilder(
              interaction.guild.id,
              interaction.user.id
            );

            await interaction.update({
              content:
                '🗑️ Rascunho cancelado.',
              embeds: [],
              components: []
            });

            return;

          case 'builder_create': {
            if (
              !state.roles.length &&
              !state.categories.length &&
              !state.channels.length
            ) {
              await interaction.reply(
                ephemeralPayload({
                  content:
                    '❌ Adicione pelo menos um cargo, categoria ou canal antes de criar.'
                })
              );

              return;
            }

            await interaction.update({
              content:
                '⏳ Aplicando configuração no servidor...',
              embeds: [],
              components: []
            });

            try {
              await applyTemplate(
                interaction.guild,
                state
              );

              clearBuilder(
                interaction.guild.id,
                interaction.user.id
              );

              await interaction.editReply({
                content:
                  '✅ **Servidor configurado com sucesso!**\n\n' +
                  'Os cargos, categorias, canais e bloqueios definidos no construtor foram aplicados.',
                embeds: [],
                components: []
              });
            } catch (error) {
              console.error(
                '❌ Erro ao criar servidor:',
                error
              );

              await interaction.editReply({
                content:
                  `❌ **Não foi possível concluir.**\n\n${String(
                    error.message ||
                    error
                  ).slice(
                    0,
                    1500
                  )}`,

                embeds: [],

                components: [
                  new ActionRowBuilder()
                    .addComponents(
                      new ButtonBuilder()
                        .setCustomId(
                          'builder_back'
                        )
                        .setLabel(
                          'Voltar ao construtor'
                        )
                        .setEmoji('↩️')
                        .setStyle(
                          ButtonStyle.Secondary
                        )
                    )
                ]
              });
            }

            return;
          }

          // ======================================================
          // CONFIGURAÇÃO DO CANAL
          // ======================================================

          case 'channel_readonly': {
            if (
              !state.editingChannel
            ) {
              return;
            }

            state.editingChannel.readonly =
              !state.editingChannel.readonly;

            saveBuilder(
              interaction.guild.id,
              interaction.user.id,
              state
            );

            await showChannelConfig(
              interaction,
              state.editingChannel
            );

            return;
          }

          case 'channel_personalize': {
            if (
              !state.editingChannel
            ) {
              return;
            }

            state.editingChannel.personalize =
              !state.editingChannel.personalize;

            saveBuilder(
              interaction.guild.id,
              interaction.user.id,
              state
            );

            await showChannelConfig(
              interaction,
              state.editingChannel
            );

            return;
          }

          case 'channel_clear_rules': {
            if (
              !state.editingChannel
            ) {
              return;
            }

            state.editingChannel.denyViewRoles =
              [];

            state.editingChannel.denySendRoles =
              [];

            state.editingChannel.readonly =
              false;

            saveBuilder(
              interaction.guild.id,
              interaction.user.id,
              state
            );

            await showChannelConfig(
              interaction,
              state.editingChannel
            );

            return;
          }

          case 'channel_save': {
            if (
              !state.editingChannel
            ) {
              return;
            }

            state.channels.push({
              ...state.editingChannel
            });

            state.editingChannel =
              null;

            saveBuilder(
              interaction.guild.id,
              interaction.user.id,
              state
            );

            await showBuilder(
              interaction,
              state
            );

            return;
          }

          case 'channel_cancel':
            state.editingChannel =
              null;

            saveBuilder(
              interaction.guild.id,
              interaction.user.id,
              state
            );

            await showBuilder(
              interaction,
              state
            );

            return;
        }
      }

      // ========================================================
      // SELECT DE CARGOS
      // ========================================================

      if (
        interaction.isRoleSelectMenu()
      ) {
        if (
          !state.editingChannel
        ) {
          return;
        }

        if (
          interaction.customId ===
          'channel_deny_view_select'
        ) {
          const selected = [];

          for (
            const id of interaction.values
          ) {
            const role =
              interaction.guild.roles.cache.get(
                id
              );

            if (
              role &&
              !role.managed
            ) {
              selected.push(
                role.name
              );
            }
          }

          state.editingChannel.denyViewRoles =
            unique(
              selected
            );
        }

        if (
          interaction.customId ===
          'channel_deny_send_select'
        ) {
          const selected = [];

          for (
            const id of interaction.values
          ) {
            const role =
              interaction.guild.roles.cache.get(
                id
              );

            if (
              role &&
              !role.managed
            ) {
              selected.push(
                role.name
              );
            }
          }

          state.editingChannel.denySendRoles =
            unique(
              selected
            );
        }

        saveBuilder(
          interaction.guild.id,
          interaction.user.id,
          state
        );

        await showChannelConfig(
          interaction,
          state.editingChannel
        );

        return;
      }

      // ========================================================
      // MODAIS
      // ========================================================

      if (
        interaction.isModalSubmit()
      ) {
        // ------------------------------------------------------
        // CARGO
        // ------------------------------------------------------

        if (
          interaction.customId ===
          'modal_role'
        ) {
          if (
            state.roles.length >=
            MAX_ITEMS
          ) {
            await interaction.reply(
              ephemeralPayload({
                content:
                  `❌ Limite de ${MAX_ITEMS} cargos no rascunho.`
              })
            );

            return;
          }

          const name =
            cleanName(
              interaction.fields.getTextInputValue(
                'name'
              )
            );

          const level =
            parseLevel(
              interaction.fields.getTextInputValue(
                'level'
              )
            ) || 1;

          const description =
            interaction.fields.getTextInputValue(
              'permissions'
            );

          const color =
            interaction.fields.getTextInputValue(
              'color'
            ) || null;

          const permissions =
            permissionsForLevel(
              level,
              description
            );

          const existing =
            state.roles.find(
              role =>
                normalize(
                  role.name
                ) ===
                normalize(
                  name
                )
            );

          const config = {
            name,
            level,
            permissions,
            color
          };

          if (existing) {
            Object.assign(
              existing,
              config
            );
          } else {
            state.roles.push(
              config
            );
          }

          saveBuilder(
            interaction.guild.id,
            interaction.user.id,
            state
          );

          await interaction.reply(
            ephemeralPayload({
              content:
                `✅ Cargo **${name}** configurado.\n` +
                `Nível: **${level}**\n` +
                `Permissões: **${
                  permissions.includes(
                    'Administrator'
                  )
                    ? 'Administrator'
                    : permissions.length
                }**.`
            })
          );

          return;
        }

        // ------------------------------------------------------
        // CATEGORIA
        // ------------------------------------------------------

        if (
          interaction.customId ===
          'modal_category'
        ) {
          if (
            state.categories.length >=
            MAX_ITEMS
          ) {
            await interaction.reply(
              ephemeralPayload({
                content:
                  `❌ Limite de ${MAX_ITEMS} categorias no rascunho.`
              })
            );

            return;
          }

          const name =
            cleanName(
              interaction.fields.getTextInputValue(
                'name'
              )
            );

          const visibility =
            normalize(
              interaction.fields.getTextInputValue(
                'visibility'
              )
            );

          const privateCategory =
            /(privad|somente|so)/.test(
              visibility
            ) &&
            !/(public|públic)/.test(
              visibility
            );

          const config = {
            name,
            private:
              privateCategory
          };

          const existing =
            state.categories.find(
              category =>
                normalize(
                  category.name
                ) ===
                normalize(
                  name
                )
            );

          if (existing) {
            Object.assign(
              existing,
              config
            );
          } else {
            state.categories.push(
              config
            );
          }

          saveBuilder(
            interaction.guild.id,
            interaction.user.id,
            state
          );

          await interaction.reply(
            ephemeralPayload({
              content:
                `✅ Categoria **${name}** configurada como **${
                  privateCategory
                    ? 'privada 🔒'
                    : 'pública 🌎'
                }**.`
            })
          );

          return;
        }

        // ------------------------------------------------------
        // CANAL
        // ------------------------------------------------------

        if (
          interaction.customId ===
          'modal_channel'
        ) {
          const name =
            cleanName(
              interaction.fields.getTextInputValue(
                'name'
              )
            );

          const typeText =
            normalize(
              interaction.fields.getTextInputValue(
                'type'
              )
            );

          const category =
            interaction.fields
              .getTextInputValue(
                'category'
              )
              .trim() ||
            null;

          const personalizationText =
            normalize(
              interaction.fields.getTextInputValue(
                'personalize'
              )
            );

          const personalize =
            personalizationText
              ? !/(nao|não|no|off)/.test(
                  personalizationText
                )
              : state.personalize;

          let type =
            'text';

          if (
            /(voz|voice|call|audio)/.test(
              typeText
            )
          ) {
            type =
              'voice';
          }

          if (
            /(anuncio|anúncio|announcement)/.test(
              typeText
            )
          ) {
            type =
              'announcement';
          }

          const config = {
            name,
            type,
            category,
            personalize,
            private: false,
            readonly: false,
            denyViewRoles: [],
            denySendRoles: []
          };

          state.editingChannel =
            config;

          saveBuilder(
            interaction.guild.id,
            interaction.user.id,
            state
          );

          await interaction.reply(
            ephemeralPayload({
              embeds: [
                channelConfigEmbed(
                  config
                )
              ],
              components:
                channelConfigRows()
            })
          );

          return;
        }

        // ------------------------------------------------------
        // IA
        // ------------------------------------------------------

        if (
          interaction.customId ===
          'modal_ai'
        ) {
          const description =
            interaction.fields.getTextInputValue(
              'description'
            );

          const result =
            interpretSingleRequest(
              description,
              state
            );

          saveBuilder(
            interaction.guild.id,
            interaction.user.id,
            state
          );

          await interaction.reply(
            ephemeralPayload({
              content:
                `${result}\n\n` +
                '⚠️ **Importante:** a sugestão foi colocada no rascunho. Revise no painel antes de criar o servidor.'
            })
          );

          return;
        }
      }
    } catch (error) {
      console.error(
        '❌ Erro em interactionCreate:',
        error
      );

      const payload =
        ephemeralPayload({
          content:
            '❌ Ocorreu um erro ao processar essa ação. Veja os logs do Render para detalhes.'
        });

      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp(
            payload
          );
        } else {
          await interaction.reply(
            payload
          );
        }
      } catch {}
    }
  }
);

// ============================================================
// LOGIN / REGISTRO DOS COMANDOS
// ============================================================

client.once(
  'ready',
  async () => {
    console.log(
      `🤖 Bot online: ${client.user.tag}`
    );

    try {
      // Remove comandos globais antigos.
      await client.application.commands.set(
        []
      );

      // Deixa somente /painel em cada servidor.
      for (
        const guild of client.guilds.cache.values()
      ) {
        await guild.commands.set([
          painelCommand.toJSON()
        ]);

        console.log(
          `✅ /painel registrado em: ${guild.name}`
        );
      }

      console.log(
        '🧹 Comandos antigos removidos.'
      );
    } catch (error) {
      console.error(
        '❌ Erro registrando /painel:',
        error
      );
    }
  }
);

client.on(
  'guildCreate',
  async guild => {
    try {
      await guild.commands.set([
        painelCommand.toJSON()
      ]);

      console.log(
        `✅ /painel registrado no novo servidor: ${guild.name}`
      );
    } catch (error) {
      console.error(
        `❌ Erro registrando /painel em ${guild.name}:`,
        error
      );
    }
  }
);

// ============================================================
// ERROS GLOBAIS
// ============================================================

process.on(
  'unhandledRejection',
  error =>
    console.error(
      '❌ Unhandled rejection:',
      error
    )
);

process.on(
  'uncaughtException',
  error =>
    console.error(
      '❌ Uncaught exception:',
      error
    )
);

// ============================================================
// LOGIN
// ============================================================

client.login(
  TOKEN
).catch(
  error => {
    console.error(
      '❌ Falha ao conectar no Discord:',
      error
    );

    process.exit(1);
  }
);
