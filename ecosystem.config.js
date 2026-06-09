const path = require("path");
const root = __dirname;

module.exports = {
  apps: [
    {
      name: "trading-backend",
      script: path.join(root, "backend", "start-pm2.bat"),
      cwd: path.join(root, "backend"),
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      min_uptime: "10s",
      out_file: path.join(root, "logs", "backend.log"),
      error_file: path.join(root, "logs", "backend-error.log"),
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "trading-frontend",
      script: "npm",
      args: "run start",
      cwd: path.join(root, "frontend"),
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      out_file: path.join(root, "logs", "frontend.log"),
      error_file: path.join(root, "logs", "frontend-error.log"),
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
