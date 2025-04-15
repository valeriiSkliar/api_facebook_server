import { Logger } from '@nestjs/common';

export class PrefixedLogger {
  private readonly prefix: string;
  private readonly logger: Logger;

  constructor(logger: Logger, instance: object) {
    this.logger = logger;
    this.prefix = `[${instance.constructor.name}]`;
  }

  log(...args: any[]) {
    if (typeof args[0] === 'string') {
      this.logger.log(`${this.prefix} ${args[0]}`, ...args.slice(1));
    } else {
      this.logger.log(this.prefix, ...args);
    }
  }

  debug(...args: any[]) {
    if (typeof args[0] === 'string') {
      this.logger.debug(`${this.prefix} ${args[0]}`, ...args.slice(1));
    } else {
      this.logger.debug(this.prefix, ...args);
    }
  }

  info(...args: any[]) {
    if (typeof args[0] === 'string') {
      this.logger.log(`${this.prefix} ${args[0]}`, ...args.slice(1));
    } else {
      this.logger.log(this.prefix, ...args);
    }
  }

  warn(...args: any[]) {
    if (typeof args[0] === 'string') {
      this.logger.warn(`${this.prefix} ${args[0]}`, ...args.slice(1));
    } else {
      this.logger.warn(this.prefix, ...args);
    }
  }

  error(...args: any[]) {
    if (typeof args[0] === 'string') {
      this.logger.error(`${this.prefix} ${args[0]}`, ...args.slice(1));
    } else {
      this.logger.error(this.prefix, ...args);
    }
  }
}
