module.exports = {
  apps: [
    {
      name: "palworld-dashboard",
      cwd: "/root/palworld-owner-platform",
      script: "npm",
      args: "run dashboard:start",
      env_file: "/root/palworld-owner-platform/.env.dashboard",
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "palworld-bot",
      cwd: "/root/palworld-owner-platform",
      script: "npm",
      args: "start",
      env_file: "/root/palworld-owner-platform/.env.bot",
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
