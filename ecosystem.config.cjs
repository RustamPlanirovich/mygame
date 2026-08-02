module.exports = {
  apps: [
    {
      name: 'mygame',
      cwd: __dirname,
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '750M',
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
