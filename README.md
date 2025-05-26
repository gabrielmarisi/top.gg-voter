# top.gg-voter

An automated voting client for top.gg bot listings with support for multiple Discord tokens, proxy rotation, and customizable voting cycles.

> [!WARNING]
> **I don't take any responsibility for blocked Discord accounts that used this module.**

> [!CAUTION]
> **Using this on a user account is prohibited by the [Discord TOS](https://discord.com/terms) and can lead to the account block.**

## Features

- 🤖 **Automated Voting**: Continuously vote for your bot on top.gg
- 🔄 **Multiple Token Support**: Use multiple Discord tokens for increased voting power
- 🌐 **Proxy Support**: Rotate through multiple proxies to avoid rate limiting
- ⚡ **Parallel/Sequential Execution**: Choose between parallel or sequential token processing
- 🕒 **Customizable Cooldowns**: Set custom intervals between voting cycles
- 📊 **Built-in Statistics**: Track successful, failed, and invalid votes
- 🛡️ **Error Handling**: Comprehensive error handling with custom error logging
- 🔍 **Verbose Logging**: Detailed logging for debugging and monitoring
- ✅ **Token Validation**: Automatic Discord token validation before voting
- 🎯 **Turnstile Support**: Built-in Cloudflare Turnstile bypass

## Requirements

- **Node.js**: 18.0.0 or higher (20.x recommended)
- **Dependencies**: `puppeteer-real-browser`

## Installation

```bash
npm install top.gg-voter
```

## Quick Start

```javascript
const { AutoClient } = require('top.gg-voter');

const client = new AutoClient({
  tokenList: ['YOUR_DISCORD_TOKEN_1', 'YOUR_DISCORD_TOKEN_2'],
  botId: 'YOUR_BOT_ID',
  verbose: true
});

client.autovoteBot();
```

## Get Token ?

<strong>Run code (Discord Console - [Ctrl + Shift + I])</strong>

```js
window.webpackChunkdiscord_app.push([
  [Math.random()],
  {},
  req => {
    if (!req.c) return;
    for (const m of Object.keys(req.c)
      .map(x => req.c[x].exports)
      .filter(x => x)) {
      if (m.default && m.default.getToken !== undefined) {
        return copy(m.default.getToken());
      }
      if (m.getToken !== undefined) {
        return copy(m.getToken());
      }
    }
  },
]);
window.webpackChunkdiscord_app.pop();
console.log('%cWorked!', 'font-size: 50px');
console.log(`%cYou now have your token in the clipboard!`, 'font-size: 16px');
```

## API Reference

### AutoClient

#### Constructor Options

```javascript
new AutoClient({
  tokenList,      // string[] - Array of Discord tokens (required)
  botId,          // string - Your bot's top.gg ID (required)
  cooldown,       // number - ms between cycles (default: 12 hours)
  runInParallel,  // boolean - Process tokens simultaneously (default: false)
  proxies,        // string[] - Proxy URLs (optional)
  fetchFn,        // Function - Custom fetch function (default: global.fetch)
  verbose,        // boolean - Enable detailed logging (default: false)
  errorLog        // Function - Custom error handler (default: throws)
})
```

#### Methods

- `autovoteBot()` - Start the continuous voting loop
- `_log(message)` - Internal logging method
- `_handleError(error)` - Internal error handling

## Examples

### Basic Usage

```javascript
const { AutoClient } = require('top.gg-voter');

const client = new AutoClient({
  tokenList: [
    'YOUR_DISCORD_TOKEN'
  ],
  botId: 'YOUR_BOT_ID',
  verbose: true
});

client.autovoteBot();
```

### Advanced Configuration

```javascript
const { AutoClient } = require('top.gg-voter');

const client = new AutoClient({
  tokenList: [
    'TOKEN_1',
    'TOKEN_2',
    'TOKEN_3'
  ],
  botId: 'YOUR_BOT_ID',
  cooldown: 6 * 60 * 60 * 1000,  // 6 hours
  runInParallel: true,            // Vote with all tokens simultaneously
  proxies: [
    'http://user:pass@proxy1.com:8080',
    'http://user:pass@proxy2.com:8080',
    'socks5://user:pass@proxy3.com:1080'
  ],
  verbose: true,
  errorLog: (error) => {
    console.error(`[${new Date().toISOString()}] ERROR:`, error.message);
    // Send to your logging service
  }
});

client.autovoteBot().catch(console.error);
```

### Functional Approach

```javascript
const { autovoteBot } = require('top.gg-voter');

autovoteBot({
  tokenList: ['YOUR_TOKEN'],
  botId: 'YOUR_BOT_ID',
  cooldown: 12 * 60 * 60 * 1000,  // 12 hours
  verbose: true
});
```

### Error Handling

```javascript
const { AutoClient } = require('top.gg-voter');

const client = new AutoClient({
  tokenList: ['YOUR_TOKEN'],
  botId: 'YOUR_BOT_ID',
  verbose: true,
  errorLog: (error) => {
    if (error.message.includes('Invalid token')) {
      console.log('Token expired, removing from rotation...');
      // Handle token removal logic
    } else if (error.message.includes('Vote')) {
      console.log('Vote failed, will retry next cycle');
    } else {
      console.error('Unexpected error:', error);
    }
  }
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

client.autovoteBot();
```

## Configuration Options

### Proxy Format

Supported proxy formats:
- HTTP: `http://username:password@host:port`
- HTTPS: `https://username:password@host:port`
- SOCKS5: `socks5://username:password@host:port`

### Cooldown Settings

Common cooldown configurations:
- **12 hours**: `12 * 60 * 60 * 1000` (default)
- **6 hours**: `6 * 60 * 60 * 1000`
- **24 hours**: `24 * 60 * 60 * 1000`

### Token Management

- Tokens are automatically validated before each vote attempt
- Invalid tokens are logged and skipped
- Tokens should have the `bot` scope for Discord applications

## Statistics

The client tracks voting statistics:

```javascript
client.stats = {
  total: 3,      // Total number of tokens
  success: 2,    // Successful votes this cycle
  failed: 1,     // Failed vote attempts
  invalid: 0     // Invalid/expired tokens
}
```

## Troubleshooting

### Common Issues

1. **Browser not opening**: Ensure you have sufficient system resources and Chrome/Chromium installed
2. **Token validation fails**: Check token format and permissions
3. **Proxy connection errors**: Verify proxy credentials and connectivity
4. **Rate limiting**: Increase cooldown time or use more proxies

### Debug Mode

Enable verbose logging for detailed information:

```javascript
const client = new AutoClient({
  // ... other options
  verbose: true
});
```

## Performance Tips

- Use `runInParallel: false` for better stability with many tokens
- Implement proxy rotation for high-volume voting
- Monitor system resources when using multiple browser instances
- Use appropriate cooldown times to avoid rate limiting

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## Disclaimer

This tool is for educational purposes only. Users are responsible for complying with Discord's Terms of Service and top.gg's policies. The authors assume no liability for account suspensions or other consequences resulting from the use of this software.
