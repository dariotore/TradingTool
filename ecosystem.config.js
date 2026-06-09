const path = require("path");
const root = __dirname;

module.exports = {
  apps: [
    {
      name: "trading-backend",
      script: path.join(root, "backend", "start-pm2.bat"),
      cwd: path.join(root, "backend"),
      watch: false,

      // ── Restart automatico ──────────────────────────────────────────────────
      autorestart: true,
      // Backoff esponenziale: 100ms → 200 → 400 → ... → max 30s
      // Evita loop di crash continui che consumano CPU
      exp_backoff_restart_delay: 100,
      max_restarts: 999,      // nessun limite pratico
      min_uptime: "5s",       // se crasha prima di 5s conta come restart instabile

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
