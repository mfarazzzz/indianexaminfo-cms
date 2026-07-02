/**
 * PM2 ecosystem config for production deployment
 *
 * Usage:
 *   npm install -g pm2 serve
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup    # auto-start on reboot
 *
 * Logs: pm2 logs indianexaminfo-cms
 * Monitor: pm2 monit
 */
module.exports = {
  apps: [
    {
      name: "indianexaminfo-cms",
      script: "serve",          // global `serve` package: npm i -g serve
      args: "dist -p 4000 -s --no-clipboard",
      cwd: "/var/www/indianexaminfo-cms",

      // Environment
      env: {
        NODE_ENV: "production",
      },

      // Process management
      instances: 1,             // SPA static server — 1 instance is sufficient
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,      // Wait 5s before restart to avoid tight loop
      min_uptime: "10s",        // Must stay up 10s to count as stable start

      // Memory / performance
      max_memory_restart: "256M",
      watch: false,             // Never watch files in production

      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      out_file: "/var/log/pm2/cms-out.log",
      error_file: "/var/log/pm2/cms-error.log",
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
    },
  ],
};
