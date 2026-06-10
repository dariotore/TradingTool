const path = require("path");
const root = __dirname;
const isWin = process.platform === "win32";

module.exports = {
  apps: [
    {
      name: "trading-backend",
      script: path.join(root, "backend", isWin ? "start-pm2.bat" : "start-pm2.sh"),
      cwd: path.join(root, "backend"),
      watch: false,

      // ── Restart automatico ──────────────────────────────────────────────────
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 999,
      min_uptime: "5s",
      max_memory_restart: "1024M", // riavvio se Python supera 1024MB
      cron_restart: "0 4 * * *",   // riavvio preventivo ogni notte alle 04:00

      // ── Log ────────────────────────────────────────────────────────────────
      out_file:        path.join(root, "logs", "backend.log"),
      error_file:      path.join(root, "logs", "backend-error.log"),
      merge_logs:      true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      log_type:        "json",
    },
    {
      name: "trading-frontend",
      script: "npm",
      args: "run start",
      cwd: path.join(root, "frontend"),
      watch: false,

      // ── Restart automatico ──────────────────────────────────────────────────
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 999,
      min_uptime: "5s",
      max_memory_restart: "1024M", // riavvio se Next.js supera 1024MB
      cron_restart: "0 4 * * *",   // riavvio preventivo ogni notte alle 04:00

      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },

      // ── Log ────────────────────────────────────────────────────────────────
      out_file:        path.join(root, "logs", "frontend.log"),
      error_file:      path.join(root, "logs", "frontend-error.log"),
      merge_logs:      true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      log_type:        "json",
    },
  ],
};
