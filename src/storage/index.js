const { createJsonStorage } = require("./jsonStorage");
const { createSupabaseStorage } = require("./supabaseStorage");
const { createSupabaseStorageV2 } = require("./supabaseStorageV2");

const DEFAULT_STORAGE_PROVIDER = "json";

// This factory is the centralized switch point for storage backends. JSON stays
// the default runtime backend until the Supabase cutover is explicitly enabled.
function createStorage(config) {
  const provider = (process.env.STORAGE_PROVIDER || DEFAULT_STORAGE_PROVIDER)
    .trim()
    .toLowerCase();

  if (provider === "json") {
    return createJsonStorage(config);
  }

  if (provider === "supabase") {
    return createSupabaseStorage(config);
  }

  if (provider === "supabase-v2") {
    return createSupabaseStorageV2(config);
  }

  throw new Error(
    `Unsupported STORAGE_PROVIDER "${process.env.STORAGE_PROVIDER}". Use "json", "supabase", or "supabase-v2".`
  );
}

module.exports = {
  createStorage,
};
