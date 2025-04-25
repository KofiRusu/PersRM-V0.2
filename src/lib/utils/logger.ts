import chalk from 'chalk';

/**
 * Logger levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  timestamps: boolean;
}

/**
 * Simple logger utility
 */
class Logger {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    prefix: 'PersRM',
    timestamps: true
  };

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Format a log message with timestamps and prefix
   */
  private format(message: string): string {
    const timestamp = this.config.timestamps ? `[${new Date().toISOString()}] ` : '';
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    
    return `${timestamp}${prefix}${message}`;
  }

  /**
   * Log a debug message
   */
  debug(...args: any[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
      console.debug(chalk.gray(this.format(message)));
    }
  }

  /**
   * Log an info message
   */
  info(...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
      console.info(chalk.white(this.format(message)));
    }
  }

  /**
   * Log a warning message
   */
  warn(...args: any[]): void {
    if (this.config.level <= LogLevel.WARN) {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
      console.warn(chalk.yellow(this.format(message)));
    }
  }

  /**
   * Log an error message
   */
  error(...args: any[]): void {
    if (this.config.level <= LogLevel.ERROR) {
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        } else if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        } else {
          return arg;
        }
      }).join(' ');
      
      console.error(chalk.red(this.format(message)));
    }
  }

  /**
   * Log a success message
   */
  success(...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
      console.info(chalk.green(this.format(message)));
    }
  }
}

// Export a singleton instance
export const logger = new Logger(); 