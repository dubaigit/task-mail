/**
 * IoC Container for Database Services - Dependency Injection Management
 */

const EventEmitter = require('events');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'service-container' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/container.log' })
  ]
});

class ServiceContainer extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Map();
    this.dependencies = new Map();
    this.lifecycleHooks = new Map();
    this.isInitialized = false;
  }

  /**
   * Register a service factory
   */
  register(name, factory, options = {}) {
    const config = {
      singleton: options.singleton || false,
      dependencies: options.dependencies || [],
      lifecycle: options.lifecycle || 'transient',
      healthCheck: options.healthCheck || null,
      ...options
    };

    this.factories.set(name, factory);
    this.dependencies.set(name, config);

    logger.debug(`Service registered: ${name}`, { config });
    this.emit('serviceRegistered', { name, config });

    return this;
  }

  /**
   * Register a singleton service
   */
  singleton(name, factory, options = {}) {
    return this.register(name, factory, { ...options, singleton: true });
  }

  /**
   * Get service instance with dependency resolution
   */
  async get(name) {
    if (!this.factories.has(name)) {
      throw new Error(`Service '${name}' not registered`);
    }

    const config = this.dependencies.get(name);

    // Return singleton if exists
    if (config.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Resolve dependencies
    const resolvedDependencies = {};
    for (const dependency of config.dependencies) {
      if (typeof dependency === 'string') {
        resolvedDependencies[dependency] = await this.get(dependency);
      } else if (typeof dependency === 'object') {
        const { name: depName, as } = dependency;
        resolvedDependencies[as || depName] = await this.get(depName);
      }
    }

    // Create service instance
    const factory = this.factories.get(name);
    let instance;

    if (typeof factory === 'function') {
      instance = await factory(resolvedDependencies, this);
    } else {
      instance = factory;
    }

    // Execute lifecycle hooks
    await this.executeLifecycleHook(name, 'onCreate', instance);

    // Store singleton
    if (config.singleton) {
      this.singletons.set(name, instance);
    }

    logger.debug(`Service instantiated: ${name}`);
    this.emit('serviceCreated', { name, instance });

    return instance;
  }

  /**
   * Initialize all registered services
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing service container...');

    try {
      // Resolve dependency order using topological sort
      const initOrder = this.resolveDependencyOrder();
      
      // Initialize services in dependency order
      for (const serviceName of initOrder) {
        const config = this.dependencies.get(serviceName);
        if (config.singleton) {
          await this.get(serviceName);
        }
      }

      this.isInitialized = true;
      logger.info('✅ Service container initialized successfully');
      this.emit('containerInitialized');

    } catch (error) {
      logger.error('❌ Service container initialization failed:', error);
      this.emit('containerError', error);
      throw error;
    }
  }

  /**
   * Resolve dependency order using topological sort
   */
  resolveDependencyOrder() {
    const visited = new Set();
    const visiting = new Set();
    const result = [];

    const visit = (serviceName) => {
      if (visited.has(serviceName)) return;
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving: ${serviceName}`);
      }

      visiting.add(serviceName);
      const config = this.dependencies.get(serviceName);
      
      if (config && config.dependencies) {
        for (const dep of config.dependencies) {
          const depName = typeof dep === 'string' ? dep : dep.name;
          visit(depName);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      result.push(serviceName);
    };

    for (const serviceName of this.factories.keys()) {
      visit(serviceName);
    }

    return result;
  }

  /**
   * Execute lifecycle hooks
   */
  async executeLifecycleHook(serviceName, hookName, instance) {
    const hooks = this.lifecycleHooks.get(`${serviceName}.${hookName}`);
    if (hooks) {
      for (const hook of hooks) {
        await hook(instance, this);
      }
    }
  }

  /**
   * Add lifecycle hook
   */
  addLifecycleHook(serviceName, hookName, hook) {
    const key = `${serviceName}.${hookName}`;
    if (!this.lifecycleHooks.has(key)) {
      this.lifecycleHooks.set(key, []);
    }
    this.lifecycleHooks.get(key).push(hook);
  }

  /**
   * Perform health checks on all services
   */
  async healthCheck() {
    const results = {};
    const startTime = Date.now();

    for (const [serviceName, config] of this.dependencies.entries()) {
      if (config.healthCheck && config.singleton && this.singletons.has(serviceName)) {
        try {
          const instance = this.singletons.get(serviceName);
          const result = await config.healthCheck(instance);
          results[serviceName] = { 
            status: 'healthy', 
            result,
            responseTime: Date.now() - startTime
          };
        } catch (error) {
          results[serviceName] = { 
            status: 'unhealthy', 
            error: error.message,
            responseTime: Date.now() - startTime
          };
        }
      }
    }

    return {
      overall: Object.values(results).every(r => r.status === 'healthy'),
      services: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown of all services
   */
  async shutdown() {
    logger.info('Shutting down service container...');

    try {
      const shutdownOrder = this.resolveDependencyOrder().reverse();

      for (const serviceName of shutdownOrder) {
        if (this.singletons.has(serviceName)) {
          const instance = this.singletons.get(serviceName);
          
          // Execute shutdown lifecycle hook
          await this.executeLifecycleHook(serviceName, 'onDestroy', instance);
          
          // Call shutdown method if exists
          if (instance && typeof instance.shutdown === 'function') {
            await instance.shutdown();
          }

          this.singletons.delete(serviceName);
          logger.debug(`Service shut down: ${serviceName}`);
        }
      }

      this.isInitialized = false;
      logger.info('✅ Service container shutdown complete');
      this.emit('containerShutdown');

    } catch (error) {
      logger.error('Error during service container shutdown:', error);
      throw error;
    }
  }

  /**
   * Get container metrics
   */
  getMetrics() {
    return {
      registeredServices: this.factories.size,
      activeSingletons: this.singletons.size,
      isInitialized: this.isInitialized,
      dependencyGraph: Array.from(this.dependencies.entries()).map(([name, config]) => ({
        name,
        dependencies: config.dependencies,
        singleton: config.singleton
      }))
    };
  }
}

module.exports = ServiceContainer;