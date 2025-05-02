const fs = require('fs');
const path = require('path');

// Creates a mock module in node_modules
function createMockModule(moduleName, exportObject) {
  const moduleDir = path.join(__dirname, 'node_modules', moduleName);
  const indexPath = path.join(moduleDir, 'index.js');
  const packagePath = path.join(moduleDir, 'package.json');
  
  // Ensure directory exists
  if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir, { recursive: true });
  }
  
  // Create package.json
  fs.writeFileSync(packagePath, JSON.stringify({
    name: moduleName,
    version: '1.0.0',
    main: 'index.js'
  }, null, 2));
  
  // Create index.js with mock exports
  fs.writeFileSync(indexPath, exportObject);
  
  console.log(`Created mock module: ${moduleName}`);
}

// Create mock modules for dependencies
const dependencies = [
  {
    name: 'clsx',
    exports: `
module.exports = function clsx() {
  return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
};
module.exports.default = module.exports;
    `
  },
  {
    name: 'tailwind-merge',
    exports: `
exports.twMerge = function twMerge() {
  return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
};
    `
  },
  {
    name: 'lucide-react',
    exports: `
const React = require('react');

function createIconComponent(name) {
  return function(props) {
    return React.createElement('svg', {
      width: 24,
      height: 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      ...props
    });
  };
}

exports.X = createIconComponent('X');
exports.PlusIcon = createIconComponent('PlusIcon');
exports.MinusIcon = createIconComponent('MinusIcon');
exports.Clock = createIconComponent('Clock');
exports.CheckCircle2 = createIconComponent('CheckCircle2');
exports.Circle = createIconComponent('Circle');
exports.AlertCircle = createIconComponent('AlertCircle');
    `
  },
  {
    name: '@radix-ui/react-toast',
    exports: `
const React = require('react');

function forwardRef(Component) {
  return React.forwardRef(Component);
}

exports.Root = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Viewport = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Title = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Description = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Action = forwardRef((props, ref) => React.createElement('button', { ...props, ref }));
exports.Close = forwardRef((props, ref) => React.createElement('button', { ...props, ref }));
exports.Provider = (props) => React.createElement('div', props);
    `
  },
  {
    name: '@radix-ui/react-dialog',
    exports: `
const React = require('react');

function forwardRef(Component) {
  return React.forwardRef(Component);
}

exports.Root = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Trigger = forwardRef((props, ref) => React.createElement('button', { ...props, ref }));
exports.Portal = (props) => React.createElement('div', props);
exports.Overlay = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Content = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Title = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Description = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Close = forwardRef((props, ref) => React.createElement('button', { ...props, ref }));
    `
  },
  {
    name: '@radix-ui/react-progress',
    exports: `
const React = require('react');

function forwardRef(Component) {
  return React.forwardRef(Component);
}

exports.Root = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
exports.Indicator = forwardRef((props, ref) => React.createElement('div', { ...props, ref }));
    `
  },
  {
    name: 'class-variance-authority',
    exports: `
exports.cva = function cva(base, options) {
  return function(props) {
    return base;
  };
};
    `
  },
  {
    name: 'express',
    exports: `
const http = require('http');
const path = require('path');

function express() {
  const app = {
    _handlers: { get: {}, post: {}, use: [] },
    
    get: function(path, handler) {
      this._handlers.get[path] = handler;
      return this;
    },
    
    post: function(path, handler) {
      this._handlers.post[path] = handler;
      return this;
    },
    
    use: function(middleware) {
      this._handlers.use.push(middleware);
      return this;
    },
    
    listen: function(port, callback) {
      console.log(\`Express mock server would start on port \${port}\`);
      if (callback) callback();
      return this;
    },
    
    static: function(dir) {
      return function(req, res, next) { next(); };
    }
  };
  
  app.static = express.static;
  
  return app;
}

express.static = function(dir) {
  return function(req, res, next) { next(); };
};

module.exports = express;
  `
  }
];

// Create each mock module
dependencies.forEach(dep => {
  createMockModule(dep.name, dep.exports);
});

console.log('Mock dependencies created successfully.'); 