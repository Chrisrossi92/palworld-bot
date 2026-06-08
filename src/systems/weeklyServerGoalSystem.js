const weeklyServerGoalDefinition = {
  key: "weekly-capture-100",
  title: "Together, capture 100 Pals this week.",
  description: "Server-wide successful captures",
  target: 100,
};

function toDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function getUtcWeekStartDate(value = new Date()) {
  const date = toDate(value);
  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const day = utcDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);

  return utcDate.toISOString().slice(0, 10);
}

function normalizeWeeklyServerGoalState(existingState, options = {}) {
  const weekStartDate = options.weekStartDate || getUtcWeekStartDate(options.now);
  const goalKey = weeklyServerGoalDefinition.key;
  const target = weeklyServerGoalDefinition.target;

  if (
    !existingState ||
    typeof existingState !== "object" ||
    existingState.weekStartDate !== weekStartDate ||
    existingState.goalKey !== goalKey
  ) {
    return {
      weekStartDate,
      goalKey,
      progress: 0,
      target,
      completedAt: null,
    };
  }

  const progress =
    Number.isInteger(existingState.progress) && existingState.progress >= 0
      ? Math.min(existingState.progress, target)
      : 0;

  return {
    weekStartDate,
    goalKey,
    progress,
    target,
    completedAt:
      typeof existingState.completedAt === "string"
        ? existingState.completedAt
        : null,
  };
}

function getCurrentWeeklyServerGoal(existingState, options = {}) {
  return normalizeWeeklyServerGoalState(existingState, options);
}

function incrementWeeklyServerGoalProgress(existingState, amount = 1, options = {}) {
  const state = normalizeWeeklyServerGoalState(existingState, options);
  const increment = Number.isInteger(amount) && amount > 0 ? amount : 0;
  const previousProgress = state.progress;
  const wasComplete = previousProgress >= state.target;
  const progress = Math.min(state.target, previousProgress + increment);
  const completedAt = state.completedAt ||
    (!wasComplete && progress >= state.target
      ? toDate(options.now || new Date()).toISOString()
      : null);

  return {
    state: {
      ...state,
      progress,
      completedAt,
    },
    previousProgress,
    progress,
    incrementedBy: progress - previousProgress,
    completed: progress >= state.target,
    newlyCompleted: !wasComplete && progress >= state.target,
  };
}

function getWeeklyServerGoalStatus(existingState, options = {}) {
  const state = normalizeWeeklyServerGoalState(existingState, options);
  const completionPercentage = state.target > 0
    ? Math.min(100, Number(((state.progress / state.target) * 100).toFixed(1)))
    : 0;

  return {
    definition: { ...weeklyServerGoalDefinition },
    state,
    complete: state.progress >= state.target,
    completionPercentage,
    resetLabel: "Resets Monday at 00:00 UTC",
  };
}

module.exports = {
  getCurrentWeeklyServerGoal,
  getUtcWeekStartDate,
  getWeeklyServerGoalStatus,
  incrementWeeklyServerGoalProgress,
  normalizeWeeklyServerGoalState,
  weeklyServerGoalDefinition,
};
