import { LogLevel } from '../types/index.js';

const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel;
  private useColors: boolean;

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.useColors = process.env.NO_COLOR !== '1';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    
    let output = `[${timestamp}] ${levelStr} ${message}`;
    
    if (data !== undefined) {
      output += `\n${JSON.stringify(data, null, 2)}`;
    }

    if (this.useColors) {
      return `${LOG_COLORS[level]}${output}${LOG_COLORS.reset}`;
    }
    
    return output;
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  // Log with timing information
  async timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.info(`Starting: ${label}`);
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`Completed: ${label} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Failed: ${label} (${duration}ms)`, error);
      throw error;
    }
  }

  // Create a child logger with a prefix
  child(prefix: string): ChildLogger {
    return new ChildLogger(this, prefix);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private prefix: string
  ) {}

  private formatPrefix(message: string): string {
    return `[${this.prefix}] ${message}`;
  }

  debug(message: string, data?: unknown): void {
    this.parent.debug(this.formatPrefix(message), data);
  }

  info(message: string, data?: unknown): void {
    this.parent.info(this.formatPrefix(message), data);
  }

  warn(message: string, data?: unknown): void {
    this.parent.warn(this.formatPrefix(message), data);
  }

  error(message: string, data?: unknown): void {
    this.parent.error(this.formatPrefix(message), data);
  }
}

// Export singleton instance
export const logger = new Logger();
