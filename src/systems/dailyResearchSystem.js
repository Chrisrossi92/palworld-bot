const dailyResearchDefinitions = [
  {
    key: "field-research-3-captures",
    title: "Complete today's field research",
    description: "Try 3 captures.",
    target: 3,
    rewards: {
      coins: 75,
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

function normalizeDailyResearchState(existingState, options = {}) {
  const date = options.date || getTodayKey(options.now);
  const definition = getDailyResearchDefinition(existingState?.assignmentKey);

  if (
    !existingState ||
    typeof existingState !== "object" ||
    existingState.date !== date
  ) {
    return {
      date,
      assignmentKey: defaultAssignment.key,
      progress: 0,
      target: defaultAssignment.target,
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
  incrementDailyResearchProgress,
  isDailyResearchComplete,
  normalizeDailyResearchState,
};
