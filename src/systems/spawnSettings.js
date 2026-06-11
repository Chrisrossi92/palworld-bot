const MIN_SPAWN_INTERVAL_MINUTES = 30;
const DEFAULT_SPAWN_INTERVAL_MINUTES = 60;

function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSpawnSettings(settings = {}) {
  const intervalMinutes = Number(
    settings.intervalMinutes ?? settings.interval_minutes ?? DEFAULT_SPAWN_INTERVAL_MINUTES
  );

  return {
    guildId: settings.guildId ?? settings.guild_id ?? null,
    enabled: Boolean(settings.enabled),
    channelId: settings.channelId ?? settings.channel_id ?? null,
    intervalMinutes,
    lastSpawnAt: toDate(settings.lastSpawnAt ?? settings.last_spawn_at),
    nextSpawnAt: toDate(settings.nextSpawnAt ?? settings.next_spawn_at),
    createdAt: toDate(settings.createdAt ?? settings.created_at),
    updatedAt: toDate(settings.updatedAt ?? settings.updated_at),
  };
}

function validateSpawnSettings(settings = {}) {
  const normalized = normalizeSpawnSettings(settings);
  const errors = [];

  if (!normalized.guildId) {
    errors.push("guild_id is required.");
  }

  if (
    !Number.isInteger(normalized.intervalMinutes) ||
    normalized.intervalMinutes < MIN_SPAWN_INTERVAL_MINUTES
  ) {
    errors.push(`interval_minutes must be at least ${MIN_SPAWN_INTERVAL_MINUTES}.`);
  }

  if (normalized.enabled && !normalized.channelId) {
    errors.push("channel_id is required when enabled is true.");
  }

  return {
    valid: errors.length === 0,
    errors,
    settings: normalized,
  };
}

function getNextSpawnAt(from = new Date(), intervalMinutes = DEFAULT_SPAWN_INTERVAL_MINUTES) {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < MIN_SPAWN_INTERVAL_MINUTES) {
    throw new Error(`interval_minutes must be at least ${MIN_SPAWN_INTERVAL_MINUTES}.`);
  }

  return new Date(from.getTime() + intervalMinutes * 60_000);
}

function isSpawnSettingDue(settings, now = new Date()) {
  const validation = validateSpawnSettings(settings);

  if (!validation.valid || !validation.settings.enabled) {
    return false;
  }

  return (
    validation.settings.nextSpawnAt instanceof Date &&
    validation.settings.nextSpawnAt.getTime() <= now.getTime()
  );
}

function getDueSpawnSettings(settingsList = [], now = new Date()) {
  return settingsList
    .map((settings) => validateSpawnSettings(settings))
    .filter((validation) => validation.valid && isSpawnSettingDue(validation.settings, now))
    .map((validation) => validation.settings);
}

module.exports = {
  DEFAULT_SPAWN_INTERVAL_MINUTES,
  MIN_SPAWN_INTERVAL_MINUTES,
  getDueSpawnSettings,
  getNextSpawnAt,
  isSpawnSettingDue,
  normalizeSpawnSettings,
  validateSpawnSettings,
};
