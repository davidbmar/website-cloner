import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

class Logger {
  constructor(config = {}) {
    this.level = config.level || 'info';
    this.logToFile = config.logToFile || false;
    this.logDirectory = config.logDirectory || './logs';
    this.progressUpdates = config.progressUpdates !== false;

    // Create log directory if logging to file
    if (this.logToFile) {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFilePath = path.join(this.logDirectory, `clone-${timestamp}.log`);
    }

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    this.currentLevelValue = this.levels[this.level] || 2;
  }

  _write(level, message, data = null) {
    if (this.levels[level] > this.currentLevelValue) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = data
      ? `[${timestamp}] [${level.toUpperCase()}] ${message} ${JSON.stringify(data)}`
      : `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // Write to file if enabled
    if (this.logToFile && this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, logMessage + '\n');
      } catch (err) {
        console.error('Failed to write to log file:', err.message);
      }
    }

    // Write to console with colors
    const coloredMessage = this._colorize(level, message);
    if (data) {
      console.log(coloredMessage, data);
    } else {
      console.log(coloredMessage);
    }
  }

  _colorize(level, message) {
    const timestamp = chalk.gray(new Date().toLocaleTimeString());

    switch (level) {
      case 'error':
        return `${timestamp} ${chalk.red.bold('ERROR')} ${chalk.red(message)}`;
      case 'warn':
        return `${timestamp} ${chalk.yellow.bold('WARN')} ${chalk.yellow(message)}`;
      case 'info':
        return `${timestamp} ${chalk.blue.bold('INFO')} ${message}`;
      case 'debug':
        return `${timestamp} ${chalk.gray('DEBUG')} ${chalk.gray(message)}`;
      case 'success':
        return `${timestamp} ${chalk.green.bold('SUCCESS')} ${chalk.green(message)}`;
      default:
        return `${timestamp} ${message}`;
    }
  }

  error(message, data = null) {
    this._write('error', message, data);
  }

  warn(message, data = null) {
    this._write('warn', message, data);
  }

  info(message, data = null) {
    this._write('info', message, data);
  }

  debug(message, data = null) {
    this._write('debug', message, data);
  }

  success(message, data = null) {
    // Success is always shown regardless of level
    const currentLevel = this.currentLevelValue;
    this.currentLevelValue = 999; // Temporarily set high
    this._write('success', message, data);
    this.currentLevelValue = currentLevel;
  }

  progress(message) {
    if (this.progressUpdates) {
      process.stdout.write('\r' + chalk.cyan(message));
    }
  }

  clearProgress() {
    if (this.progressUpdates) {
      process.stdout.write('\r\x1b[K'); // Clear line
    }
  }

  section(title) {
    const separator = chalk.bold('='.repeat(60));
    console.log('\n' + separator);
    console.log(chalk.bold.cyan(title));
    console.log(separator + '\n');
  }
}

export default Logger;
