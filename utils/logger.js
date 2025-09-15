/**
 * Logger utility for A la Mesa
 * Optimized logging system that reduces resource consumption in production
 */

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.logLevel = process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'warn');
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data && typeof data === 'object') {
      // En producción, limitar el tamaño de los logs de datos
      if (!this.isDevelopment && JSON.stringify(data).length > 500) {
        return formatted + ' [DATA TOO LARGE]';
      }
      return formatted + ' ' + JSON.stringify(data);
    }

    return formatted;
  }

  error(message, data = null) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data));
    }
  }

  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  info(message, data = null) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  // Método específico para logs de performance
  perf(message, startTime) {
    if (this.shouldLog('debug')) {
      const duration = Date.now() - startTime;
      this.debug(`${message} (${duration}ms)`);
    }
  }

  // Método para logs de seguridad (siempre se loggean)
  security(message, data = null) {
    const securityMessage = `[SECURITY] ${message}`;
    console.warn(this.formatMessage('warn', securityMessage, data));
  }
}

// Exportar instancia singleton
const logger = new Logger();

module.exports = logger;
