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
  MessageFlags
} = require("discord.js");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN não configurado.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const P = PermissionFlagsBits;

const MAX_DESCRIPTION_LENGTH = 4000;
const PREVIEW_TTL = 10 * 60 * 1000;

/* =========================================================
   PERMISSÕES SUPORTADAS
========================================================= */

const PERMISSIONS = {
  Administrator: P.Administrator,

  ManageGuild: P.ManageGuild,
  ManageChannels: P.ManageChannels,
  ManageRoles: P.ManageRoles,
  ManageMessages: P.ManageMessages,

  KickMembers: P.KickMembers,
  BanMembers: P.BanMembers,
  ModerateMembers: P.ModerateMembers,

  ViewChannel: P.ViewChannel,
  SendMessages: P.SendMessages,
  ReadMessageHistory: P.ReadMessageHistory,

  Connect: P.Connect,
  Speak: P.Speak,

  MentionEveryone: P.MentionEveryone,
  AttachFiles: P.AttachFiles,
  EmbedLinks: P.EmbedLinks,
  AddReactions: P.AddReactions,

  UseExternalEmojis: P.UseExternalEmojis,
  UseExternalStickers: P.UseExternalStickers,

  CreateInstantInvite: P.CreateInstantInvite,

  ManageWebhooks: P.ManageWebhooks,
  ManageNicknames: P.ManageNicknames,
  ChangeNickname: P.ChangeNickname,

  SendMessagesInThreads: P.SendMessagesInThreads,
  CreatePublicThreads: P.CreatePublicThreads,
  CreatePrivateThreads: P.CreatePrivateThreads,

  UseApplicationCommands: P.UseApplicationCommands,
  UseEmbeddedActivities: P.UseEmbeddedActivities
};

/* =========================================================
   NOMES ALTERNATIVOS DE PERMISSÕES
========================================================= */

const ALIASES = {
  administrador: "Administrator",
  admin: "Administrator",
  dono: "Administrator",

  "gerenciar servidor": "ManageGuild",
  "administrar servidor": "ManageGuild",

  "gerenciar canais": "ManageChannels",
  "administrar canais": "ManageChannels",

  "gerenciar cargos": "ManageRoles",
  "administrar cargos": "ManageRoles",

  "gerenciar mensagens": "ManageMessages",
  "administrar mensagens": "ManageMessages",

  "moderar mensagens": "ManageMessages",

  expulsar: "KickMembers",
  kick: "KickMembers",

  banir: "BanMembers",
  ban: "BanMembers",

  timeout: "ModerateMembers",
  moderar: "ModerateMembers",

  "ver canal": "ViewChannel",
  visualizar: "ViewChannel",

  escrever: "SendMessages",
  "enviar mensagens": "SendMessages",

  "ler histórico": "ReadMessageHistory",

  conectar: "Connect",
  falar: "Speak",

  "mencionar todos": "MentionEveryone",

  anexos: "AttachFiles",
  "enviar arquivos": "AttachFiles",

  embeds: "EmbedLinks",

  reações: "AddReactions",

  "emojis externos": "UseExternalEmojis",

  convites: "CreateInstantInvite",

  webhooks: "ManageWebhooks",

  apelidos: "ManageNicknames",
  "alterar apelido": "ChangeNickname"
};

/* =========================================================
   NÍVEIS DE PERMISSÃO
========================================================= */

const LEVELS = {
  1: [
    "ViewChannel",
    "SendMessages",
    "ReadMessageHistory",
    "Connect",
    "Speak",
    "AttachFiles",
    "EmbedLinks",
    "AddReactions",
    "UseExternalEmojis",
    "UseApplicationCommands"
  ],

  2: [
    "ViewChannel",
    "SendMessages",
    "ReadMessageHistory",
    "Connect",
    "Speak",
    "AttachFiles",
    "EmbedLinks",
    "AddReactions",
    "UseExternalEmojis",
    "UseApplicationCommands",
    "ManageNicknames",
    "ManageMessages"
  ],

  3: [
    "ViewChannel",
    "SendMessages",
    "ReadMessageHistory",
    "Connect",
    "Speak",
    "AttachFiles",
    "EmbedLinks",
    "AddReactions",
    "UseExternalEmojis",
    "UseApplicationCommands",
    "ManageNicknames",
    "ManageMessages",
    "ModerateMembers",
    "KickMembers"
  ],

  4: [
    "ViewChannel",
    "SendMessages",
    "ReadMessageHistory",
    "Connect",
    "Speak",
    "AttachFiles",
    "EmbedLinks",
    "AddReactions",
    "UseExternalEmojis",
    "UseExternalStickers",
    "UseApplicationCommands",
    "ManageNicknames",
    "ManageMessages",
    "ModerateMembers",
    "KickMembers",
    "BanMembers",
    "ManageGuild",
    "ManageChannels",
    "ManageRoles",
    "ManageWebhooks",
    "MentionEveryone",
    "CreateInstantInvite"
  ],

  5: [
    "Administrator"
  ]
};

/* =========================================================
   TIPOS DE CANAIS
========================================================= */

const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  chat: ChannelType.GuildText,
  texto: ChannelType.GuildText,

  announcement: ChannelType.GuildAnnouncement,
  anuncio: ChannelType.GuildAnnouncement,
  anuncios: ChannelType.GuildAnnouncement,

  forum: ChannelType.GuildForum,
  fórum: ChannelType.GuildForum,

  voice: ChannelType.GuildVoice,
  voz: ChannelType.GuildVoice,

  stage: ChannelType.GuildStageVoice
};

/* =========================================================
   ARMAZENAMENTO TEMPORÁRIO
========================================================= */

const pending = new Map();

/* =========================================================
   TEXTO
========================================================= */

function norm(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(value, fallback = "Sem nome") {
  return String(value || fallback)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function slug(value) {
  return (
    norm(value)
      .replace(/[^a-z0-9\s_-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "novo-canal"
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

/* =========================================================
   CORES
========================================================= */

function getColor(value) {
  const text = norm(value);

  const colors = {
    vermelho: "#ED4245",
    azul: "#3498DB",
    verde: "#2ECC71",
    amarelo: "#F1C40F",
    laranja: "#E67E22",
    roxo: "#9B59B6",
    rosa: "#EB459E",
    ciano: "#1ABC9C",
    preto: "#000000",
    branco: "#FFFFFF"
  };

  for (const [name, color] of Object.entries(colors)) {
    if (text.includes(name)) {
      return color;
    }
  }

  return "#5865F2";
}

function getHex(value) {
  const clean = String(value || "")
    .replace("#", "")
    .trim();

  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return parseInt(clean, 16);
  }

  return 0x5865F2;
}

/* =========================================================
   PERMISSÕES
========================================================= */

function resolvePermission(value) {
  const normalized = norm(value);

  if (PERMISSIONS[normalized]) {
    return normalized;
  }

  if (ALIASES[normalized]) {
    return ALIASES[normalized];
  }

  for (const [alias, permission] of Object.entries(ALIASES)) {
    if (normalized.includes(alias)) {
      return permission;
    }
  }

  return null;
}

function findPermissionNames(text) {
  const normalized = norm(text);
  const result = [];

  for (const name of Object.keys(PERMISSIONS)) {
    if (normalized.includes(norm(name))) {
      result.push(name);
    }
  }

  for (const [alias, permission] of Object.entries(ALIASES)) {
    if (normalized.includes(alias)) {
      result.push(permission);
    }
  }

  return unique(result);
}

function permissionBits(names) {
  return new PermissionsBitField(
    unique(names || [])
      .map(resolvePermission)
      .filter(Boolean)
      .map(permission => PERMISSIONS[permission])
  );
}

/* =========================================================
   NÍVEL
========================================================= */

function getLevel(text, fallback = 1) {
  const normalized = norm(text);

  const match = normalized.match(
    /\bn[ií]vel\s*([1-5])\b/
  );

  if (match) {
    return Number(match[1]);
  }

  if (
    /\bdono\b|\bowner\b|\bcriador\b/.test(normalized)
  ) {
    return 5;
  }

  if (
    /\badministrador\b|\badmin\b/.test(normalized)
  ) {
    return 4;
  }

  if (
    /\bmoderador\b|\bmod\b/.test(normalized)
  ) {
    return 3;
  }

  if (
    /\bajudante\b|\bhelper\b|\bsuporte\b/.test(normalized)
  ) {
    return 2;
  }

  return fallback;
}

/* =========================================================
   PERMISSÕES DE UM CARGO
========================================================= */

function permissionsFor(text, level) {
  const normalized = norm(text);

  let permissions =
    level === 5
      ? ["Administrator"]
      : [...(LEVELS[level] || LEVELS[1])];

  const wantsAll =
    /todas as permissoes|todas permissoes|tudo/.test(
      normalized
    );

  if (wantsAll && level !== 5) {
    permissions = Object.keys(PERMISSIONS).filter(
      permission => permission !== "Administrator"
    );
  }

  const negativePatterns = [
    /sem ([^.;,\n]+)/g,
    /menos ([^.;,\n]+)/g,
    /exceto ([^.;,\n]+)/g,
    /retire ([^.;,\n]+)/g,
    /retirar ([^.;,\n]+)/g
  ];

  for (const pattern of negativePatterns) {
    let match;

    while ((match = pattern.exec(normalized))) {
      const denied =
        findPermissionNames(match[1]);

      permissions = permissions.filter(
        permission =>
          !denied.includes(permission)
      );
    }
  }

  if (!wantsAll && level !== 5) {
    permissions.push(
      ...findPermissionNames(normalized)
    );
  }

  return unique(permissions);
}

/* =========================================================
   DUPLICADOS
========================================================= */

function dedupe(items) {
  const map = new Map();

  for (const item of items) {
    const key = norm(item.name);

    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

/* =========================================================
   NOME DO SERVIDOR
========================================================= */

function detectServerName(text) {
  const patterns = [
    /nome do servidor\s*[:=-]\s*(.+)/i,
    /servidor chamado\s+(.+)/i,
    /servidor se chama\s+(.+)/i,
    /nome\s*[:=-]\s*(.+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return cleanName(match[1]);
    }
  }

  if (/futebol/i.test(text)) {
    return "Comunidade de Futebol";
  }

  return "Novo Servidor";
}

/* =========================================================
   DETECÇÃO DE CARGOS
========================================================= */

function detectRoles(text) {
  const roles = [];

  for (const line of text.split("\n")) {
    const cleanLine = line.trim();

    const match = cleanLine.match(
      /^[-•*]?\s*(.+?)\s+n[ií]vel\s*([1-5])/i
    );

    if (!match) continue;

    const name = cleanName(match[1]);
    const level = Number(match[2]);

    if (!name) continue;

    roles.push({
      name,
      level,
      color: getColor(cleanLine),
      permissions: permissionsFor(
        cleanLine,
        level
      ),
      position: level,
      hoist: level >= 2,
      mentionable: true
    });
  }

  const normalized = norm(text);

  const defaults = [
    [/\bdono\b|\bowner\b/, "Dono", 5],
    [
      /\badministrador\b|\badmin\b/,
      "Administrador",
      4
    ],
    [
      /\bmoderador\b|\bmod\b/,
      "Moderador",
      3
    ],
    [
      /\bajudante\b|\bhelper\b|\bsuporte\b/,
      "Ajudante",
      2
    ],
    [
      /\bmembro\b|\bmember\b|\busuario\b/,
      "Membro",
      1
    ]
  ];

  for (const [pattern, name, level] of defaults) {
    if (
      pattern.test(normalized) &&
      !roles.some(
        role =>
          norm(role.name) === norm(name)
      )
    ) {
      roles.push({
        name,
        level,
        color: getColor(name),
        permissions: permissionsFor(
          `${name} nível ${level}`,
          level
        ),
        position: level,
        hoist: level >= 2,
        mentionable: true
      });
    }
  }

  if (
    !roles.some(role => role.level === 1)
  ) {
    roles.push({
      name: "Membro",
      level: 1,
      color: "#FFFFFF",
      permissions: [...LEVELS[1]],
      position: 1,
      hoist: false,
      mentionable: true
    });
  }

  return dedupe(roles);
}

/* =========================================================
   DETECÇÃO DE CATEGORIAS
========================================================= */

function detectCategories(text) {
  const categories = [];
  let active = false;

  for (const line of text.split("\n")) {
    const cleanLine = line.trim();
    const normalized = norm(cleanLine);

    if (
      /^categorias?:/.test(normalized) ||
      normalized === "categorias"
    ) {
      active = true;
      continue;
    }

    if (
      /^(canais|cargos|regras|preferencias|preferências):?/.test(
        normalized
      )
    ) {
      active = false;
    }

    const visibilityMatch =
      cleanLine.match(
        /^[-•*]?\s*(.+?)\s+(p[uú]blica?|privada?|p[uú]blico|privado)$/i
      );

    if (visibilityMatch) {
      categories.push({
        name: cleanName(
          visibilityMatch[1]
        ),
        visibility:
          /privad/i.test(
            visibilityMatch[2]
          )
            ? "private"
            : "public",
        position:
          categories.length + 1
      });

      continue;
    }

    if (
      active &&
      cleanLine &&
      !cleanLine.includes(":") &&
      cleanLine.length <= 100
    ) {
      categories.push({
        name: cleanName(
          cleanLine.replace(
            /^[-•*]\s*/,
            ""
          )
        ),
        visibility:
          /admin|equipe/i.test(
            cleanLine
          )
            ? "private"
            : "public",
        position:
          categories.length + 1
      });
    }
  }

  const normalized = norm(text);

  const automatic = [
    ["comunidade", "COMUNIDADE", "public"],
    ["futebol", "FUTEBOL", "public"],
    ["jogos", "JOGOS", "public"],
    ["voz", "VOZ", "public"],
    ["admin", "ADMINISTRAÇÃO", "private"],
    ["equipe", "EQUIPE", "private"]
  ];

  for (const [
    keyword,
    name,
    visibility
  ] of automatic) {
    if (
      normalized.includes(keyword) &&
      !categories.some(
        category =>
          norm(category.name) ===
          norm(name)
      )
    ) {
      categories.push({
        name,
        visibility,
        position:
          categories.length + 1
      });
    }
  }

  if (!categories.length) {
    categories.push({
      name: "COMUNIDADE",
      visibility: "public",
      position: 1
    });
  }

  return dedupe(categories);
}

/* =========================================================
   CATEGORIAS
========================================================= */

function categoryFromText(
  categories,
  text
) {
  const normalized = norm(text);

  return (
    categories.find(category =>
      normalized.includes(
        norm(category.name)
      )
    )?.name || null
  );
}

function categoryByKeyword(
  categories,
  keyword
) {
  return (
    categories.find(category =>
      norm(category.name).includes(
        norm(keyword)
      )
    )?.name || null
  );
}

/* =========================================================
   DETECÇÃO DE CANAIS
========================================================= */

function detectChannels(
  text,
  categories
) {
  const channels = [];
  let active = false;

  for (const line of text.split("\n")) {
    const cleanLine = line.trim();
    const normalized = norm(cleanLine);

    if (
      /^canais?:/.test(normalized) ||
      normalized === "canais"
    ) {
      active = true;
      continue;
    }

    if (
      /^(cargos|categorias|regras|preferencias|preferências):?/.test(
        normalized
      )
    ) {
      active = false;
    }

    if (!active || !cleanLine) {
      continue;
    }

    const raw = cleanLine
      .replace(/^[-•*]\s*/, "")
      .replace(/^#/, "")
      .trim();

    if (
      !raw ||
      raw.length > 100
    ) {
      continue;
    }

    let type = "text";

    if (
      /\bvoz\b|\bvoice\b|\bsala de voz\b/.test(
        normalized
      )
    ) {
      type = "voice";
    }

    if (
      /\bf[oó]rum\b|\bforum\b/.test(
        normalized
      )
    ) {
      type = "forum";
    }

    let visibility = "public";

    if (
      /somente leitura|read only|apenas leitura/.test(
        normalized
      )
    ) {
      visibility = "readonly";
    } else if (
      /somente admins|apenas admins|s[oó] admins|privado para admins/.test(
        normalized
      )
    ) {
      visibility = "admins";
    } else if (
      /somente mods|apenas mods|privado para mods/.test(
        normalized
      )
    ) {
      visibility = "mods";
    } else if (
      /privado|privada/.test(
        normalized
      )
    ) {
      visibility = "private";
    }

    const display = raw
      .replace(
        /\s+(somente leitura|read only|somente admins|apenas admins|s[oó] admins|privado|privada|p[uú]blico|p[uú]blica).*$/i,
        ""
      )
      .trim();

    channels.push({
      name: slug(display),
      type,
      category:
        categoryFromText(
          categories,
          raw
        ) ||
        categoryByKeyword(
          categories,
          "comunidade"
        ) ||
        categories[0].name,
      visibility,
      position:
        channels.length + 1
    });
  }

  const automatic = [
    [
      /\bregras\b/,
      "regras",
      "readonly"
    ],
    [
      /\bchat geral\b|\bchat-geral\b|\bchat\b/,
      "chat-geral",
      "public"
    ],
    [
      /\bnot[ií]cias\b/,
      "noticias",
      "public"
    ],
    [
      /\bmemes\b/,
      "memes",
      "public"
    ],
    [
      /\blogs?\b/,
      "logs",
      "admins"
    ]
  ];

  for (const [
    pattern,
    name,
    visibility
  ] of automatic) {
    if (
      pattern.test(norm(text)) &&
      !channels.some(
        channel =>
          channel.name === name
      )
    ) {
      channels.push({
        name,
        type: "text",
        category:
          visibility === "admins"
            ? categoryByKeyword(
                categories,
                "admin"
              )
            : categoryByKeyword(
                categories,
                "comunidade"
              ) ||
              categories[0].name,
        visibility,
        position:
          channels.length + 1
      });
    }
  }

  if (!channels.length) {
    channels.push(
      {
        name: "regras",
        type: "text",
        category:
          categories[0].name,
        visibility: "readonly",
        position: 1
      },
      {
        name: "chat-geral",
        type: "text",
        category:
          categories[0].name,
        visibility: "public",
        position: 2
      }
    );
  }

  return dedupe(channels);
}

/* =========================================================
   INTERPRETADOR
========================================================= */

function interpret(text) {
  if (!text || !text.trim()) {
    throw new Error(
      "Descreva como você quer seu servidor."
    );
  }

  if (
    text.length >
    MAX_DESCRIPTION_LENGTH
  ) {
    throw new Error(
      `A descrição pode ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`
    );
  }

  const roles =
    detectRoles(text);

  const categories =
    detectCategories(text);

  const channels =
    detectChannels(
      text,
      categories
    );

  for (const channel of channels) {
    const category =
      categories.find(
        item =>
          norm(item.name) ===
          norm(channel.category)
      );

    if (
      category &&
      category.visibility ===
        "private" &&
      channel.visibility ===
        "public"
    ) {
      channel.visibility =
        "private";
    }
  }

  return {
    version: 1,

    server: {
      name: detectServerName(text)
    },

    roles,

    categories,

    channels
  };
}

/* =========================================================
   VALIDAÇÃO
========================================================= */

function validateTemplate(template) {
  if (
    !template ||
    typeof template !== "object"
  ) {
    throw new Error(
      "Template inválido."
    );
  }

  if (
    !template.server ||
    typeof template.server.name !==
      "string"
  ) {
    throw new Error(
      "Nome do servidor inválido."
    );
  }

  if (
    !Array.isArray(
      template.roles
    ) ||
    !Array.isArray(
      template.categories
    ) ||
    !Array.isArray(
      template.channels
    )
  ) {
    throw new Error(
      "O template precisa possuir cargos, categorias e canais."
    );
  }

  const roleNames =
    new Set();

  for (const role of template.roles) {
    if (!role.name) {
      throw new Error(
        "Existe um cargo sem nome."
      );
    }

    const key =
      norm(role.name);

    if (
      roleNames.has(key)
    ) {
      throw new Error(
        `Cargo duplicado: ${role.name}`
      );
    }

    roleNames.add(key);

    role.permissions =
      unique(
        (role.permissions || [])
          .map(resolvePermission)
          .filter(Boolean)
      );
  }

  const categoryNames =
    new Set();

  for (const category of template.categories) {
    if (!category.name) {
      throw new Error(
        "Existe uma categoria sem nome."
      );
    }

    const key =
      norm(category.name);

    if (
      categoryNames.has(key)
    ) {
      throw new Error(
        `Categoria duplicada: ${category.name}`
      );
    }

    categoryNames.add(key);
  }

  const channelNames =
    new Set();

  for (const channel of template.channels) {
    if (!channel.name) {
      throw new Error(
        "Existe um canal sem nome."
      );
    }

    const key =
      norm(channel.name);

    if (
      channelNames.has(key)
    ) {
      throw new Error(
        `Canal duplicado: ${channel.name}`
      );
    }

    channelNames.add(key);

    if (
      !CHANNEL_TYPES[
        channel.type
      ]
    ) {
      channel.type = "text";
    }

    if (
      channel.category &&
      !categoryNames.has(
        norm(channel.category)
      )
    ) {
      throw new Error(
        `Categoria inexistente: ${channel.category}`
      );
    }
  }
}

/* =========================================================
   PERMISSÃO DO USUÁRIO
========================================================= */

function isAdmin(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(
      P.Administrator
    )
  );
}

/* =========================================================
   OVERWRITES DE CATEGORIA
========================================================= */

function categoryOverwrites(
  guild,
  category,
  roles
) {
  if (
    category.visibility !==
    "private"
  ) {
    return [];
  }

  const overwrites = [
    {
      id:
        guild.roles.everyone.id,
      deny: [P.ViewChannel]
    }
  ];

  for (const roleData of roles) {
    if (
      roleData.level >= 4 ||
      roleData.permissions.includes(
        "Administrator"
      )
    ) {
      const role =
        guild.roles.cache.find(
          item =>
            norm(item.name) ===
            norm(roleData.name)
        );

      if (role) {
        overwrites.push({
          id: role.id,
          allow: [P.ViewChannel]
        });
      }
    }
  }

  return overwrites;
}

/* =========================================================
   OVERWRITES DE CANAL
========================================================= */

function channelOverwrites(
  guild,
  data,
  roles
) {
  const everyone =
    guild.roles.everyone.id;

  const overwrites = [];

  if (
    data.visibility ===
    "public"
  ) {
    overwrites.push({
      id: everyone,
      allow: [
        P.ViewChannel,
        P.ReadMessageHistory,
        P.SendMessages
      ]
    });

    if (
      data.type === "voice"
    ) {
      overwrites[0].allow = [
        P.ViewChannel,
        P.Connect,
        P.Speak
      ];
    }
  }

  if (
    data.visibility ===
    "readonly"
  ) {
    overwrites.push({
      id: everyone,
      allow: [
        P.ViewChannel,
        P.ReadMessageHistory
      ],
      deny: [
        P.SendMessages
      ]
    });
  }

  if (
    data.visibility ===
      "private" ||
    data.visibility ===
      "admins" ||
    data.visibility ===
      "mods"
  ) {
    overwrites.push({
      id: everyone,
      deny: [
        P.ViewChannel
      ]
    });

    const minimumLevel =
      data.visibility ===
      "mods"
        ? 3
        : 4;

    for (const roleData of roles) {
      if (
        roleData.level >=
          minimumLevel ||
        roleData.permissions.includes(
          "Administrator"
        )
      ) {
        const role =
          guild.roles.cache.find(
            item =>
              norm(item.name) ===
              norm(roleData.name)
          );

        if (role) {
          overwrites.push({
            id: role.id,
            allow: [
              P.ViewChannel,
              P.ReadMessageHistory,
              P.SendMessages
            ]
          });
        }
      }
    }
  }

  return overwrites;
}

/* =========================================================
   CRIAR / ATUALIZAR CARGOS
========================================================= */

async function ensureRoles(
  guild,
  template
) {
  const map =
    new Map();

  const botHighest =
    guild.members.me?.roles
      ?.highest;

  for (
    const data of [
      ...template.roles
    ].sort(
      (a, b) =>
        (a.position || 1) -
        (b.position || 1)
    )
  ) {
    let role =
      guild.roles.cache.find(
        item =>
          norm(item.name) ===
          norm(data.name)
      );

    if (!role) {
      role =
        await guild.roles.create({
          name: cleanName(
            data.name
          ),
          color: getHex(
            data.color
          ),
          permissions:
            permissionBits(
              data.permissions
            ),
          hoist: Boolean(
            data.hoist
          ),
          mentionable:
            Boolean(
              data.mentionable
            ),
          reason:
            "Criador Inteligente"
        });
    } else if (
      botHighest &&
      role.position <
        botHighest.position
    ) {
      await role
        .edit({
          color: getHex(
            data.color
          ),
          permissions:
            permissionBits(
              data.permissions
            ),
          hoist: Boolean(
            data.hoist
          ),
          mentionable:
            Boolean(
              data.mentionable
            ),
          reason:
            "Criador Inteligente"
        })
        .catch(error =>
          console.log(
            `⚠️ Cargo ${role.name}: ${error.message}`
          )
        );
    }

    map.set(
      norm(data.name),
      role
    );
  }

  const positions = [];

  for (const data of template.roles) {
    const role =
      map.get(
        norm(data.name)
      );

    if (
      !role ||
      role.managed ||
      !botHighest
    ) {
      continue;
    }

    if (
      role.id === guild.id
    ) {
      continue;
    }

    if (
      role.position >=
      botHighest.position
    ) {
      console.log(
        `⚠️ Não posso mover ${role.name}: cargo acima do bot.`
      );

      continue;
    }

    positions.push({
      role: role.id,
      position: Math.max(
        1,
        Number(
          data.position
        ) || 1
      )
    });
  }

  if (positions.length) {
    await guild.roles
      .setPositions(
        positions
      )
      .catch(error =>
        console.log(
          `⚠️ Hierarquia: ${error.message}`
        )
      );
  }

  return map;
}

/* =========================================================
   CATEGORIAS
========================================================= */

async function ensureCategories(
  guild,
  template
) {
  const map =
    new Map();

  for (const data of template.categories) {
    let category =
      guild.channels.cache.find(
        channel =>
          channel.type ===
            ChannelType.GuildCategory &&
          norm(channel.name) ===
            norm(data.name)
      );

    const overwrites =
      categoryOverwrites(
        guild,
        data,
        template.roles
      );

    if (!category) {
      category =
        await guild.channels.create({
          name: cleanName(
            data.name
          ),
          type:
            ChannelType.GuildCategory,
          permissionOverwrites:
            overwrites,
          reason:
            "Criador Inteligente"
        });
    } else {
      if (overwrites.length) {
        await category.permissionOverwrites
          .set(
            overwrites,
            "Criador Inteligente"
          )
          .catch(error =>
            console.log(
              `⚠️ Categoria ${category.name}: ${error.message}`
            )
          );
      }
    }

    map.set(
      norm(data.name),
      category
    );
  }

  for (const data of template.categories) {
    const category =
      map.get(
        norm(data.name)
      );

    if (!category) {
      continue;
    }

    await category
      .setPosition(
        Math.max(
          0,
          Number(
            data.position
          ) || 0
        )
      )
      .catch(error =>
        console.log(
          `⚠️ Posição da categoria ${category.name}: ${error.message}`
        )
      );
  }

  return map;
}

/* =========================================================
   CANAIS
========================================================= */

async function ensureChannels(
  guild,
  template,
  categoryMap
) {
  const created =
    [];

  for (const data of template.channels) {
    const type =
      CHANNEL_TYPES[
        data.type
      ] ||
      ChannelType.GuildText;

    let channel =
      guild.channels.cache.find(
        item =>
          item.type === type &&
          norm(item.name) ===
            norm(data.name)
      );

    const parent =
      data.category
        ? categoryMap.get(
            norm(
              data.category
            )
          )
        : null;

    const overwrites =
      channelOverwrites(
        guild,
        data,
        template.roles
      );

    if (!channel) {
      channel =
        await guild.channels.create({
          name: slug(
            data.name
          ),
          type,
          parent:
            parent?.id,
          permissionOverwrites:
            overwrites,
          reason:
            "Criador Inteligente"
        });
    } else {
      const edit = {};

      if (parent) {
        edit.parent =
          parent.id;
      }

      if (overwrites.length) {
        edit.permissionOverwrites =
          overwrites;
      }

      if (
        Object.keys(edit)
          .length
      ) {
        await channel
          .edit(edit)
          .catch(error =>
            console.log(
              `⚠️ Canal ${channel.name}: ${error.message}`
            )
          );
      }
    }

    await channel
      .setPosition(
        Math.max(
          0,
          Number(
            data.position
          ) || 0
        )
      )
      .catch(error =>
        console.log(
          `⚠️ Posição canal ${channel.name}: ${error.message}`
        )
      );

    created.push(
      channel
    );
  }

  return created;
}

/* =========================================================
   APLICAR TEMPLATE
========================================================= */

async function applyTemplate(
  guild,
  template
) {
  validateTemplate(
    template
  );

  const bot =
    guild.members.me;

  if (!bot) {
    throw new Error(
      "Não consegui localizar o bot no servidor."
    );
  }

  if (
    !bot.permissions.has(
      P.ManageRoles
    )
  ) {
    throw new Error(
      "O bot precisa da permissão **Gerenciar Cargos**."
    );
  }

  if (
    !bot.permissions.has(
      P.ManageChannels
    )
  ) {
    throw new Error(
      "O bot precisa da permissão **Gerenciar Canais**."
    );
  }

  const roles =
    await ensureRoles(
      guild,
      template
    );

  const categories =
    await ensureCategories(
      guild,
      template
    );

  const channels =
    await ensureChannels(
      guild,
      template,
      categories
    );

  return {
    roles: roles.size,
    categories:
      categories.size,
    channels:
      channels.length
  };
}

/* =========================================================
   STATUS
========================================================= */

function getStatus(guild) {
  return {
    members:
      guild.memberCount,

    roles:
      guild.roles.cache.filter(
        role =>
          role.id !== guild.id
      ).size,

    categories:
      guild.channels.cache.filter(
        channel =>
          channel.type ===
          ChannelType.GuildCategory
      ).size,

    channels:
      guild.channels.cache.filter(
        channel =>
          channel.type !==
          ChannelType.GuildCategory
      ).size
  };
}

/* =========================================================
   PRÉVIA
========================================================= */

function buildPreview(
  template
) {
  const roles =
    template.roles
      .map(
        role =>
          `• **${role.name}** — nível ${role.level}`
      )
      .join("\n")
      .slice(
        0,
        1500
      );

  const categories =
    template.categories
      .map(
        category =>
          `• **${category.name}** — ${
            category.visibility ===
            "private"
              ? "🔒 privada"
              : "🌎 pública"
          }`
      )
      .join("\n")
      .slice(
        0,
        1200
      );

  const channels =
    template.channels
      .map(
        channel =>
          `• #${channel.name} — ${
            channel.visibility ===
            "readonly"
              ? "📖 somente leitura"
              : channel.visibility ===
                  "public"
                ? "🌎 público"
                : "🔒 privado"
          }`
      )
      .join("\n")
      .slice(
        0,
        1800
      );

  return new EmbedBuilder()
    .setTitle(
      "🔎 Prévia do servidor"
    )
    .setDescription(
      `**Servidor:** ${template.server.name}\n\n` +
      `🎭 **Cargos**\n${roles || "Nenhum"}\n\n` +
      `📁 **Categorias**\n${categories || "Nenhuma"}\n\n` +
      `💬 **Canais**\n${channels || "Nenhum"}`
    )
    .setFooter({
      text:
        "Confira antes de criar."
    });
}

/* =========================================================
   PAINEL
========================================================= */

function buildPanel() {
  const embed =
    new EmbedBuilder()
      .setTitle(
        "🤖 Criador Inteligente de Servidores"
      )
      .setDescription(
        "Descreva o servidor do jeito que você fala normalmente.\n\n" +
        "🚀 **Criar Servidor**\n" +
        "🎚️ **Níveis**\n" +
        "📖 **Tutorial**\n" +
        "📋 **Modelo**\n" +
        "⚙️ **Administrar**\n" +
        "📊 **Status**"
      )
      .setFooter({
        text:
          "Painel privado • somente administradores"
      });

  const row1 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "create"
          )
          .setLabel(
            "Criar Servidor"
          )
          .setEmoji("🚀")
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            "levels"
          )
          .setLabel(
            "Níveis"
          )
          .setEmoji("🎚️")
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            "tutorial"
          )
          .setLabel(
            "Tutorial"
          )
          .setEmoji("📖")
          .setStyle(
            ButtonStyle.Secondary
          )
      );

  const row2 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "model"
          )
          .setLabel(
            "Modelo"
          )
          .setEmoji("📋")
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "admin"
          )
          .setLabel(
            "Administrar"
          )
          .setEmoji("⚙️")
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "status"
          )
          .setLabel(
            "Status"
          )
          .setEmoji("📊")
          .setStyle(
            ButtonStyle.Secondary
          )
      );

  return {
    embeds: [embed],
    components: [
      row1,
      row2
    ],
    flags:
      MessageFlags.Ephemeral
  };
}

/* =========================================================
   MODAL
========================================================= */

function buildModal() {
  const modal =
    new ModalBuilder()
      .setCustomId(
        "create_modal"
      )
      .setTitle(
        "🚀 Criar servidor"
      );

  const input =
    new TextInputBuilder()
      .setCustomId(
        "description"
      )
      .setLabel(
        "Descreva seu servidor"
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(true)
      .setMaxLength(
        MAX_DESCRIPTION_LENGTH
      )
      .setPlaceholder(
        "Ex.: comunidade de futebol, Dono nível 5, Mod nível 3, categoria admin privada..."
      );

  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(
        input
      )
  );

  return modal;
}

/* =========================================================
   RESPOSTA PRIVADA
========================================================= */

function privateReply(
  interaction,
  data
) {
  return interaction.reply({
    ...data,
    flags:
      MessageFlags.Ephemeral
  });
}

/* =========================================================
   COMANDO
========================================================= */

const painelCommand =
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription(
      "Abrir o painel do Criador Inteligente"
    )
    .setDefaultMemberPermissions(
      P.Administrator
    );

/* =========================================================
   BOT ONLINE
========================================================= */

client.once(
  "ready",
  async () => {
    console.log(
      `✅ Bot online: ${client.user.tag}`
    );

    try {
      /*
       * Remove comandos globais antigos.
       */
      await client.application.commands.set(
        []
      );

      /*
       * Cada servidor recebe somente /painel.
       */
      for (
        const guild of client.guilds.cache.values()
      ) {
        try {
          await guild.commands.set([
            painelCommand.toJSON()
          ]);

          console.log(
            `✅ /painel registrado em ${guild.name}`
          );
        } catch (error) {
          console.error(
            `❌ Erro em ${guild.name}: ${error.message}`
          );
        }
      }

      console.log(
        "✅ Comandos antigos removidos."
      );
    } catch (error) {
      console.error(
        "❌ Erro registrando comandos:",
        error
      );
    }
  }
);

/* =========================================================
   NOVO SERVIDOR
========================================================= */

client.on(
  "guildCreate",
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
        `❌ Erro no novo servidor ${guild.name}: ${error.message}`
      );
    }
  }
);

/* =========================================================
   INTERAÇÕES
========================================================= */

client.on(
  "interactionCreate",
  async interaction => {
    try {
      /* ==============================================
         SLASH COMMAND
      ============================================== */

      if (
        interaction.isChatInputCommand()
      ) {
        if (
          interaction.commandName !==
          "painel"
        ) {
          return;
        }

        if (
          !isAdmin(interaction)
        ) {
          return privateReply(
            interaction,
            {
              content:
                "❌ Apenas administradores podem usar o painel."
            }
          );
        }

        return privateReply(
          interaction,
          buildPanel()
        );
      }

      /* ==============================================
         BOTÕES
      ============================================== */

      if (
        interaction.isButton()
      ) {
        if (
          !isAdmin(interaction)
        ) {
          return privateReply(
            interaction,
            {
              content:
                "❌ Apenas administradores podem usar o painel."
            }
          );
        }

        if (
          interaction.customId ===
          "create"
        ) {
          return interaction.showModal(
            buildModal()
          );
        }

        if (
          interaction.customId ===
          "levels"
        ) {
          return privateReply(
            interaction,
            {
              content:
                "🎚️ **NÍVEIS DE PERMISSÃO**\n\n" +
                "**Nível 1 — Membro:** participação normal.\n" +
                "**Nível 2 — Ajudante:** ajuda + algumas funções.\n" +
                "**Nível 3 — Moderador:** funções de moderação.\n" +
                "**Nível 4 — Administrador:** administração sem Administrator.\n" +
                "**Nível 5 — Dono:** Administrator.\n\n" +
                "💡 Também pode escrever:\n" +
                "`todas as permissões menos banir`"
            }
          );
        }

        if (
          interaction.customId ===
          "tutorial"
        ) {
          return privateReply(
            interaction,
            {
              content:
                "📖 **TUTORIAL**\n\n" +
                "**1.** Clique em 🚀 Criar Servidor.\n" +
                "**2.** Descreva o servidor normalmente.\n" +
                "**3.** Use níveis de 1 a 5 nos cargos.\n" +
                "**4.** Diga quais categorias são públicas ou privadas.\n" +
                "**5.** Diga quais canais são públicos, privados ou somente leitura.\n" +
                "**6.** Confira a prévia.\n" +
                "**7.** Clique em Criar agora.\n\n" +
                "✅ Você não precisa escrever JSON."
            }
          );
        }

        if (
          interaction.customId ===
          "model"
        ) {
          return privateReply(
            interaction,
            {
              content:
                "📋 **MODELO**\n\n" +
                "Quero um servidor de comunidade de futebol.\n\n" +
                "CARGOS:\n" +
                "Dono nível 5\n" +
                "Administrador nível 4\n" +
                "Moderador nível 3\n" +
                "Membro nível 1\n\n" +
                "CATEGORIAS:\n" +
                "Comunidade pública\n" +
                "Futebol pública\n" +
                "Admin privada\n\n" +
                "CANAIS:\n" +
                "#regras somente leitura\n" +
                "#chat-geral público\n" +
                "#noticias público\n" +
                "#logs somente admins"
            }
          );
        }

        if (
          interaction.customId ===
          "admin"
        ) {
          const me =
            interaction.guild
              .members.me;

          return privateReply(
            interaction,
            {
              content:
                "⚙️ **ADMINISTRAÇÃO**\n\n" +
                `Gerenciar Cargos: ${
                  me?.permissions.has(
                    P.ManageRoles
                  )
                    ? "✅"
                    : "❌"
                }\n` +
                `Gerenciar Canais: ${
                  me?.permissions.has(
                    P.ManageChannels
                  )
                    ? "✅"
                    : "❌"
                }\n\n` +
                "⚠️ O bot não consegue editar cargos que estejam acima dele na hierarquia do Discord."
            }
          );
        }

        if (
          interaction.customId ===
          "status"
        ) {
          const s =
            getStatus(
              interaction.guild
            );

          return privateReply(
            interaction,
            {
              content:
                "📊 **STATUS DO SERVIDOR**\n\n" +
                `👥 Membros: **${s.members}**\n` +
                `🎭 Cargos personalizados: **${s.roles}**\n` +
                `📁 Categorias: **${s.categories}**\n` +
                `💬 Canais: **${s.channels}**`
            }
          );
        }

        if (
          interaction.customId ===
          "confirm"
        ) {
          const key =
            `${interaction.guild.id}:${interaction.user.id}`;

          const item =
            pending.get(key);

          if (
            !item ||
            item.expires <
              Date.now()
          ) {
            pending.delete(
              key
            );

            return privateReply(
              interaction,
              {
                content:
                  "⌛ A prévia expirou. Clique em Criar Servidor novamente."
              }
            );
          }

          await interaction.deferReply(
            {
              flags:
                MessageFlags.Ephemeral
            }
          );

          const result =
            await applyTemplate(
              interaction.guild,
              item.template
            );

          pending.delete(
            key
          );

          const s =
            getStatus(
              interaction.guild
            );

          return interaction.editReply(
            {
              content:
                "✅ **CONFIGURAÇÃO CONCLUÍDA!**\n\n" +
                `🎭 Cargos processados: **${result.roles}**\n` +
                `📁 Categorias processadas: **${result.categories}**\n` +
                `💬 Canais processados: **${result.channels}**\n\n` +
                "📊 **STATUS ATUAL**\n" +
                `👥 Membros: **${s.members}**\n` +
                `🎭 Cargos personalizados: **${s.roles}**\n` +
                `📁 Categorias: **${s.categories}**\n` +
                `💬 Canais: **${s.channels}**`
            }
          );
        }

        if (
          interaction.customId ===
          "cancel"
        ) {
          const key =
            `${interaction.guild.id}:${interaction.user.id}`;

          pending.delete(
            key
          );

          return privateReply(
            interaction,
            {
              content:
                "❌ Criação cancelada."
            }
          );
        }

        return;
      }

      /* ==============================================
         MODAL
      ============================================== */

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
          "create_modal"
      ) {
        if (
          !isAdmin(interaction)
        ) {
          return privateReply(
            interaction,
            {
              content:
                "❌ Apenas administradores podem usar o sistema."
            }
          );
        }

        const description =
          interaction.fields.getTextInputValue(
            "description"
          );

        const template =
          interpret(
            description
          );

        validateTemplate(
          template
        );

        const key =
          `${interaction.guild.id}:${interaction.user.id}`;

        pending.set(
          key,
          {
            template,
            expires:
              Date.now() +
              PREVIEW_TTL
          }
        );

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "confirm"
                )
                .setLabel(
                  "Criar agora"
                )
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  "cancel"
                )
                .setLabel(
                  "Cancelar"
                )
                .setEmoji("❌")
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        return privateReply(
          interaction,
          {
            embeds: [
              buildPreview(
                template
              )
            ],
            components: [
              row
            ]
          }
        );
      }
    } catch (error) {
      console.error(
        "❌ Erro na interação:",
        error
      );

      try {
        if (
          interaction.deferred
        ) {
          await interaction.editReply(
            {
              content:
                `❌ ${
                  error.message ||
                  "Erro desconhecido."
                }`
            }
          );
        } else if (
          !interaction.replied
        ) {
          await privateReply(
            interaction,
            {
              content:
                `❌ ${
                  error.message ||
                  "Erro desconhecido."
                }`
            }
          );
        }
      } catch {}
    }
  }
);

/* =========================================================
   LOGIN
========================================================= */

client
  .login(TOKEN)
  .catch(error => {
    console.error(
      "❌ Falha ao conectar o bot:",
      error
    );

    process.exit(1);
  });
