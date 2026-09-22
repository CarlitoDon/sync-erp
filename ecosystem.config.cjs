module.exports = {
  apps: [
    {
      name: 'sync-erp-api',
      cwd: '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp',
      script: 'npm',
      args: 'run dev:api',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'sync-erp-mcp',
      cwd: '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp',
      script: 'npm',
      args: 'run dev:mcp',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'sync-erp-web',
      cwd: '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp',
      script: 'npm',
      args: 'run dev:web',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'sync-erp-bot',
      cwd: '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp',
      script: 'npm',
      args: 'run dev:bot',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};
