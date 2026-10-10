// Safety net for unexpected crashes: after 10 restarts that each lived under 5 minutes,
// PM2 stops the app instead of restarting it forever (every startup may log in to GBar).
module.exports = {
  apps: [
    {
      name: 'gbar-notifier',
      script: 'dist/index.js',
      min_uptime: '5m',
      max_restarts: 10,
      restart_delay: 30000,
      time: true,
    },
  ],
};
