async function loadGuilds() {
  const select = document.querySelector("#guildSelect");
  const link = document.querySelector("#openDashboard");
  const status = document.querySelector("#connectionStatus");
  const response = await fetch("/api/guilds");
  const payload = await response.json();
  const guilds = payload.guilds || [];

  status.textContent = payload.hasSupabaseConnection
    ? "Connected to Supabase metrics."
    : "SUPABASE_DB_URL is not configured. No servers are available.";

  select.innerHTML = "";

  if (guilds.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No servers found";
    option.value = "";
    select.append(option);
    link.href = "/dashboard.html";
    return;
  }

  for (const guild of guilds) {
    const option = document.createElement("option");
    option.value = guild.id;
    option.textContent = guild.name;
    select.append(option);
  }

  function updateLink() {
    link.href = `/dashboard.html?guildId=${encodeURIComponent(select.value)}`;
  }

  select.addEventListener("change", updateLink);
  updateLink();
}

loadGuilds().catch((error) => {
  document.querySelector("#connectionStatus").textContent =
    `Unable to load servers: ${error.message}`;
});
