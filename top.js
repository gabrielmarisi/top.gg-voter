/// topgg.js
const { connect } = require("puppeteer-real-browser");

/**
 * Delay execution for a number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @typedef {Object} AutoClientOptions
 * @property {string[]} tokenList       - Array of Discord tokens.
 * @property {string}   botId           - The top.gg bot ID.
 * @property {number}   [cooldown]      - ms between vote cycles (default 12h).
 * @property {boolean}  [runInParallel] - Vote all tokens in parallel per cycle.
 * @property {string[]} [proxies]       - Optional proxy URLs (`http://user:pass@host:port`).
 * @property {Function} [fetchFn]       - Custom fetch (defaults to global.fetch).
 * @property {boolean}  [verbose]       - Whether to log progress.
 * @property {Function} [errorLog]      - fn(err) for errors; if omitted, errors throw.
 */

class AutoClient {
  /**
   * @param {AutoClientOptions} opts
   */
  constructor(opts) {
    const {
      tokenList,
      botId,
      cooldown = 12 * 60 * 60 * 1000,
      runInParallel = false,
      proxies = [],
      fetchFn = global.fetch,
      verbose = false,
      errorLog = null,
    } = opts;

    if (!Array.isArray(tokenList) || tokenList.length === 0) {
      throw new Error("tokenList must be a non-empty array");
    }
    if (typeof botId !== "string" || !/^\d{15,20}$/.test(botId)) {
      throw new Error("botId must be a valid Discord snowflake");
    }
    if (typeof cooldown !== "number" || cooldown <= 0) {
      throw new Error("cooldown must be a positive number (ms)");
    }

    this.tokenList     = tokenList;
    this.botId         = botId;
    this.cooldown      = cooldown;
    this.runInParallel = runInParallel;
    this.proxies       = proxies;
    this.fetchFn       = fetchFn;
    this.verbose       = verbose;
    this.errorLog      = errorLog;

    this.stats = {
      total:   tokenList.length,
      success: 0,
      failed:  0,
      invalid: 0,
    };
  }

  _log(msg) {
    if (this.verbose) console.log(`[AutoClient] ${msg}`);
  }

  _handleError(err) {
    if (typeof this.errorLog === "function") {
      try {
        this.errorLog(err);
      } catch (e) {
        console.error("Error in errorLog function:", e);
        throw e;
      }
    } else {
      throw err;
    }
  }

  /**
   * Start the continuous voting loop.
   */
  async autovoteBot() {
    while (true) {
      this._log(`Starting cycle for ${this.stats.total} token(s)...`);

      try {
        if (this.runInParallel) {
          await this._parallelCycle();
        } else {
          await this._sequentialCycle();
        }
      } catch (err) {
        // fatal cycle error
        this._log(`Fatal cycle error: ${err.message}`);
        this._handleError(err);
      }

      this._log(`Cycle complete. Success: ${this.stats.success}, Failed: ${this.stats.failed}, Invalid: ${this.stats.invalid}`);
      this._resetStats();
      this._log(`Waiting ${this.cooldown / 3600000}h before next cycle...`);
      await delay(this.cooldown);
    }
  }

  async _sequentialCycle() {
    for (let i = 0; i < this.tokenList.length; i++) {
      this._log(`Processing token ${i + 1}/${this.tokenList.length}...`);
      try {
        await this._handleSingle(this.tokenList[i], this.proxies[i % this.proxies.length]);
      } catch (err) {
        this._log(`Error processing token ${i + 1}: ${err.message}`);
        this._handleError(err);
      }
    }
  }

  async _parallelCycle() {
    const promises = this.tokenList.map((tok, i) => {
      return this._handleSingle(tok, this.proxies[i % this.proxies.length])
        .catch(err => {
          this._log(`Error in parallel processing for token ${i + 1}: ${err.message}`);
          this._handleError(err);
        });
    });
    
    await Promise.allSettled(promises);
  }

  async _handleSingle(token, proxy) {
    const shortT = token.slice(0, 5) + "...";
    this._log(`Starting process for token ${shortT}`);

    // validate token
    this._log(`Validating token ${shortT}...`);
    let valid = false;
    try {
      const res = await this.fetchFn("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: token },
      });
      valid = res.ok;
      this._log(`Token ${shortT} validation: ${valid ? 'valid' : 'invalid'}`);
    } catch (err) {
      this._log(`Token ${shortT} validation error: ${err.message}`);
      valid = false;
    }
    
    if (!valid) {
      this.stats.invalid++;
      const err = new Error(`Invalid token ${shortT}`);
      this._handleError(err);
      return;
    }

    // attempt vote
    this._log(`Attempting vote for token ${shortT}...`);
    try {
      const result = await this._voteForBot(token, proxy);
      if (result) {
        this.stats.success++;
        this._log(`Voted successfully for ${shortT}`);
      } else {
        this.stats.failed++;
        this._log(`Skipped (already voted or unavailable) for ${shortT}`);
      }
    } catch (err) {
      this.stats.failed++;
      this._log(`Vote attempt failed for ${shortT}: ${err.message}`);
      this._handleError(new Error(`Token ${shortT} error: ${err.message}`));
    }
  }

  async _voteForBot(token, proxy) {
    const timeoutMs = 60_000;
    const shortT = token.slice(0, 5) + "...";
    
    this._log(`Connecting to browser for ${shortT}...`);
    const opts = { 
       headless: false,
       turnstile: true,
    };
    if (proxy) {
      opts.proxy = proxy;
      this._log(`Using proxy: ${proxy}`);
    }

    let browser, page;
    try {
      this._log(`Attempting to connect to puppeteer...`);
      const connection = await Promise.race([
        connect(opts),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Browser connection timeout')), 30000)
        )
      ]);
      
      browser = connection.browser;
      page = connection.page;
      this._log(`Browser connected successfully for ${shortT}`);

      this._log(`Setting up token in localStorage for ${shortT}...`);
      await page.evaluateOnNewDocument((t) => {
        window.localStorage.setItem("token", `"${t}"`);
      }, token);

      this._log(`Navigating to top.gg for ${shortT}...`);
      await page.goto("https://top.gg", { 
        waitUntil: "load",
        timeout: 30000
      });
      await delay(3000);

      this._log(`Clicking login button for ${shortT}...`);
      await page.evaluate(() => {
        const loginBtn = [...document.querySelectorAll("button")]
          .find(btn => btn.textContent.includes("Login"));
        if (loginBtn) loginBtn.click();
      });

      this._log(`Waiting for navigation after login for ${shortT}...`);
      await page.waitForNavigation({ waitUntil: "load" });
      await page.setViewport({ width: 1920, height: 1080 });

      this._log(`Waiting for Discord authorization button for ${shortT}...`);
      await page.waitForSelector("div.action__3d3b0 button", { visible: true, timeout: 10000 });
      
      this._log(`Clicking Discord authorization button for ${shortT}...`);
      await page.click("div.action__3d3b0 button");
      await page.waitForNavigation({ waitUntil: "load" });

      await delay(3000);

      this._log(`Checking login status for ${shortT}...`);
      const isLoggedIn = await page.evaluate(() => {
        return !document.body.innerText.includes("Login");
      });

      if (!isLoggedIn) {
        throw new Error("Authorization failed - Discord OAuth did not complete");
      }
      this._log(`Authorization successful for ${shortT}`);

      this._log(`Navigating to vote page for ${shortT}...`);
      const voteUrl = `https://top.gg/bot/${this.botId}/vote`;
      await page.goto(voteUrl, { waitUntil: "load" });
      
      this._log(`Checking vote status for ${shortT}...`);
      const status = await this._waitForVoteStatus(page, timeoutMs);
      this._log(`Vote status for ${shortT}: ${status}`);

      if (status === "vote") {
        this._log(`Attempting to click vote button for ${shortT}...`);
        await delay(3000);
        await page.evaluate(() => {
          const voteBtn = [...document.querySelectorAll("button")]
            .find(btn => btn.textContent.includes("Vote") && !btn.disabled);
          if (voteBtn) voteBtn.click();
        });
        this._log(`Vote button clicked for ${shortT}`);
        await delay(5000);
        return true;
      } else if (status === "already") {
        this._log(`Already voted for ${shortT}`);
        return false;
      } else {
        this._log(`Vote did not become available in time for ${shortT}`);
        return false;
      }
    } catch (err) {
      this._log(`Error in _voteForBot for ${shortT}: ${err.message}`);
      throw err;
    } finally {
      if (browser) {
        this._log(`Closing browser for ${shortT}...`);
        try {
          await browser.close();
          this._log(`Browser closed successfully for ${shortT}`);
        } catch (closeErr) {
          this._log(`Error closing browser for ${shortT}: ${closeErr.message}`);
        }
      }
    }
  }

  async _waitForVoteStatus(page, timeoutMs) {
    const start = Date.now();
    let attempts = 0;
    
    while (Date.now() - start < timeoutMs) {
      attempts++;
      this._log(`Checking vote status (attempt ${attempts})...`);
      
      try {
        const st = await page.evaluate(() => {
          const txt = document.body.innerText;
          if (txt.includes("You can vote now!")) return "vote";
          if (txt.includes("You have already voted")) return "already";
          return "wait";
        });
        
        this._log(`Vote status check result: ${st}`);
        if (st !== "wait") return st;
      } catch (err) {
        this._log(`Error checking vote status: ${err.message}`);
      }
      
      await delay(2500);
    }
    
    this._log(`Vote status check timed out after ${attempts} attempts`);
    return "timeout";
  }

  _resetStats() {
    this.stats.success = 0;
    this.stats.failed = 0;
    this.stats.invalid = 0;
  }
}

/**
 * Functional shorthand for quick use.
 * @param {AutoClientOptions} opts
 */
async function autovoteBot(opts) {
  const client = new AutoClient(opts);
  await client.autovoteBot();
}

module.exports = {
  AutoClient,
  autovoteBot,
};

// For ESM default
module.exports.default = { AutoClient, autovoteBot };
