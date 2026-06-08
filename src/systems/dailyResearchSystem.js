const dailyResearchDefinitions = [
  {
    key: "field-research-3-captures",
    title: "Complete today's field research",
    description: "Try 3 captures.",
    progressEvent: "capture_attempt",
    target: 3,
    rewards: {
      coins: 75,
      xp: 35,
    },
  },
  {
    key: "field-research-5-captures",
    title: "Run an extended field survey",
    description: "Try 5 captures.",
    progressEvent: "capture_attempt",
    target: 5,
    rewards: {
      coins: 110,
      xp: 50,
    },
  },
  {
    key: "field-research-catch-1-pal",
    title: "Log a successful capture",
    description: "Catch 1 Pal.",
    progressEvent: "capture_success",
    target: 1,
    rewards: {
      coins: 85,
      xp: 40,
    },
  },
  {
    key: "field-research-catch-2-pals",
    title: "Confirm local Pal activity",
    description: "Catch 2 Pals.",
    progressEvent: "capture_success",
    target: 2,
    rewards: {
      coins: 125,
      xp: 60,
    },
  },
  {
    key: "field-research-3-attempts",
    title: "Test capture readiness",
    description: "Use 3 capture attempts.",
    progressEvent: "capture_attempt",
    target: 3,
    rewards: {
      coins: 70,
      xp: 35,
    },
  },
];

const defaultAssignment = dailyResearchDefinitions[0];

function getTodayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getDailyResearchDefinition(assignmentKey) {
  return dailyResearchDefinitions.find((definition) => definition.key === assignmentKey) ||
    defaultAssignment;
}

function hashAssignmentSeed(seed) {
  let hash = 0;

  for (const char of String(seed)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function chooseDailyResearchDefinition({ guildId = "", userId = "", date }) {
  if (!guildId && !userId) {
    return defaultAssignment;
  }

  const seed = `${guildId}:${userId}:${date}`;
  const index = hashAssignmentSeed(seed) % dailyResearchDefinitions.length;

  return dailyResearchDefinitions[index] || defaultAssignment;
}

function normalizeDailyResearchState(existingState, options = {}) {
  const date = options.date || getTodayKey(options.now);
  const definition = getDailyResearchDefinition(existingState?.assignmentKey);

  if (
    !existingState ||
    typeof existingState !== "object" ||
    existingState.date !== date
  ) {
    const assignment = chooseDailyResearchDefinition({
      guildId: options.guildId,
      userId: options.userId,
      date,
    });

    return {
      date,
      assignmentKey: assignment.key,
      progress: 0,
      target: assignment.target,
      claimed: false,
      claimedAt: null,
    };
  }

  const progress =
    Number.isInteger(existingState.progress) && existingState.progress >= 0
      ? existingState.progress
      : 0;
  const target =
    Number.isInteger(existingState.target) && existingState.target > 0
      ? existingState.target
      : definition.target;

  return {
    date,
    assignmentKey: definition.key,
    progress: Math.min(progress, target),
    target,
    claimed: Boolean(existingState.claimed),
    claimedAt:
      typeof existingState.claimedAt === "string"
        ? existingState.claimedAt
        : null,
  };
}

function incrementDailyResearchProgress(existingState, amount = 1, options = {}) {
  const state = normalizeDailyResearchState(existingState, options);
  const definition = getDailyResearchDefinition(state.assignmentKey);
  const eventType = options.eventType || definition.progressEvent;
  const matchesEvent =
    eventType === definition.progressEvent ||
    (eventType === "capture_success" && definition.progressEvent === "capture_attempt");

  if (!matchesEvent) {
    return state;
  }

  const increment = Number.isInteger(amount) && amount > 0 ? amount : 1;

  return {
    ...state,
    progress: Math.min(state.target, state.progress + increment),
  };
}

function isDailyResearchComplete(state) {
  return state.progress >= state.target;
}

function claimDailyResearchState(existingState, options = {}) {
  const state = normalizeDailyResearchState(existingState, options);
  const definition = getDailyResearchDefinition(state.assignmentKey);
  const complete = isDailyResearchComplete(state);

  if (!complete || state.claimed) {
    return {
      claimed: false,
      alreadyClaimed: state.claimed,
      complete,
      state,
      rewards: { ...definition.rewards },
    };
  }

  const claimedAt = (options.now || new Date()).toISOString();

  return {
    claimed: true,
    alreadyClaimed: false,
    complete: true,
    state: {
      ...state,
      claimed: true,
      claimedAt,
    },
    rewards: { ...definition.rewards },
  };
}

function getDailyResearchStatus(existingState, options = {}) {
  const state = normalizeDailyResearchState(existingState, options);
  const definition = getDailyResearchDefinition(state.assignmentKey);
  const complete = isDailyResearchComplete(state);

  return {
    state,
    assignment: {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      progressEvent: definition.progressEvent,
      target: definition.target,
    },
    rewards: { ...definition.rewards },
    complete,
    claimable: complete && !state.claimed,
  };
}

module.exports = {
  claimDailyResearchState,
  dailyResearchDefinitions,
  getDailyResearchDefinition,
  getDailyResearchStatus,
  getTodayKey,
  chooseDailyResearchDefinition,
  incrementDailyResearchProgress,
  isDailyResearchComplete,
  normalizeDailyResearchState,
};
