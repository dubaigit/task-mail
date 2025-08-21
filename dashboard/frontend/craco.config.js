/**
 * CRACO Configuration for Enhanced Cache Busting
 * Overrides Create React App webpack config without ejecting
 */

const path = require('path');
const webpack = require('webpack');
const { when, whenDev, whenProd } = require('@craco/craco');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Enhanced content hashing for production
      if (env === 'production') {
        // Ensure chunkhash is used for JS files
        webpackConfig.output.filename = 'static/js/[name].[contenthash:8].js';
        webpackConfig.output.chunkFilename = 'static/js/[name].[contenthash:8].chunk.js';
        
        // Enhanced CSS content hashing
        const miniCssExtractPlugin = webpackConfig.plugins.find(
          plugin => plugin.constructor.name === 'MiniCssExtractPlugin'
        );
        
        if (miniCssExtractPlugin) {
          miniCssExtractPlugin.options.filename = 'static/css/[name].[contenthash:8].css';
          miniCssExtractPlugin.options.chunkFilename = 'static/css/[name].[contenthash:8].chunk.css';
        }
        
        // Optimize chunk splitting for better caching
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Vendor chunk for node_modules
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true,
              },
              // React chunk for React-related packages
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
                name: 'react',
                chunks: 'all',
                priority: 20,
                reuseExistingChunk: true,
              },
              // UI libraries chunk
              ui: {
                test: /[\\/]node_modules[\\/](@radix-ui|@headlessui|framer-motion|lucide-react)[\\/]/,
                name: 'ui',
                chunks: 'all',
                priority: 15,
                reuseExistingChunk: true,
              },
              // Utilities chunk
              utils: {
                test: /[\\/]node_modules[\\/](date-fns|clsx|class-variance-authority|zustand)[\\/]/,
                name: 'utils',
                chunks: 'all',
                priority: 12,
                reuseExistingChunk: true,
              },
              // Default chunk for remaining modules
              default: {
                minChunks: 2,
                priority: -10,
                reuseExistingChunk: true,
              },
            },
          },
          // Generate consistent module IDs for better caching
          moduleIds: 'deterministic',
          chunkIds: 'deterministic',
        };
        
        // Add webpack plugins for enhanced caching
        webpackConfig.plugins.push(
          // Generate asset manifest with enhanced information
          new webpack.BannerPlugin({
            banner: `Build: ${new Date().toISOString()}\nHash: [fullhash]\nChunk: [chunkhash]`,
            test: /\.(js|css)$/,
          }),
          
          // Define build-time variables
          new webpack.DefinePlugin({
            'process.env.REACT_APP_BUILD_HASH': JSON.stringify(
              require('crypto').randomBytes(8).toString('hex')
            ),
            'process.env.REACT_APP_BUILD_TIME': JSON.stringify(new Date().toISOString()),
          })
        );
      }
      
      // Development optimizations
      if (env === 'development') {
        // Improve HMR cache efficiency
        webpackConfig.cache = {
          type: 'filesystem',
          allowCollectingMemory: true,
          cacheDirectory: path.resolve(paths.appNodeModules, '.cache', 'webpack'),
          compression: 'gzip',
          hashAlgorithm: 'xxhash64',
        };
        
        // Optimize source maps for development
        webpackConfig.devtool = 'eval-cheap-module-source-map';
      }
      
      // Add file-loader configuration for better asset hashing
      const fileLoaderRule = webpackConfig.module.rules.find(rule =>
        rule.oneOf
      )?.oneOf?.find(rule => 
        rule.type === 'asset/resource'
      );
      
      if (fileLoaderRule && env === 'production') {
        fileLoaderRule.generator = {
          filename: 'static/media/[name].[contenthash:8][ext]',
        };
      }
      
      return webpackConfig;
    },
    
    // Add custom plugins
    plugins: {
      add: [
        // Custom plugin to generate cache-busting manifest
        new (class CacheBustingManifestPlugin {
          apply(compiler) {
            compiler.hooks.emit.tapAsync('CacheBustingManifestPlugin', (compilation, callback) => {
              // Generate enhanced manifest with cache information
              const manifest = {
                buildTime: new Date().toISOString(),
                buildHash: compilation.hash,
                files: {},
                chunks: {},
                cacheStrategy: {
                  immutable: [],
                  shortTerm: [],
                  longTerm: []
                }
              };
              
              // Process assets
              Object.keys(compilation.assets).forEach(filename => {
                const asset = compilation.assets[filename];
                const isHashed = /\.[a-f0-9]{8,}\./i.test(filename);
                
                manifest.files[filename] = {
                  size: asset.size(),
                  hash: compilation.hash,
                  isHashed,
                  cacheStrategy: isHashed ? 'immutable' : 'shortTerm'
                };
                
                // Categorize for cache strategy
                if (isHashed) {
                  manifest.cacheStrategy.immutable.push(filename);
                } else if (filename.endsWith('.html') || filename.endsWith('.json')) {
                  manifest.cacheStrategy.shortTerm.push(filename);
                } else {
                  manifest.cacheStrategy.longTerm.push(filename);
                }
              });
              
              // Process chunks
              compilation.chunks.forEach(chunk => {
                manifest.chunks[chunk.name || chunk.id] = {
                  id: chunk.id,
                  files: Array.from(chunk.files),
                  hash: chunk.contentHash || chunk.hash,
                  size: chunk.size()
                };
              });
              
              // Write enhanced manifest
              const manifestJson = JSON.stringify(manifest, null, 2);
              compilation.assets['cache-manifest.json'] = {
                source: () => manifestJson,
                size: () => manifestJson.length
              };
              
              callback();
            });
          }
        })(),
        
        // Bundle analyzer for production builds
        ...(process.env.ANALYZE === 'true' ? [
          new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-report.html'
          })
        ] : [])
      ]
    }
  },
  
  // DevServer configuration for development
  devServer: whenDev(() => ({
    headers: {
      // Cache control for development assets
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    // Serve service worker in development
    setupMiddlewares: (middlewares, devServer) => {
      // Serve service worker
      devServer.app.get('/sw.js', (req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(__dirname, 'public', 'sw.js'));
      });
      
      return middlewares;
    }
  })),
  
  // Jest configuration
  jest: {
    configure: {
      // Test configuration for cache-related modules
      moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/serviceWorkerRegistration.ts',
        '!src/reportWebVitals.ts',
      ],
    },
  },
  
  // Babel configuration
  babel: {
    plugins: [
      // Add plugins for better code splitting in production only
      ...(process.env.NODE_ENV === 'production' ? [
        ['@babel/plugin-transform-react-constant-elements'],
        ['@babel/plugin-transform-react-inline-elements'],
      ] : []),
    ],
  },
  
  // ESLint configuration
  eslint: {
    configure: {
      rules: {
        // Custom rules for cache-related code
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      },
    },
  },
  
  // TypeScript configuration
  typescript: {
    enableTypeChecking: true,
  },
};

// Export additional configuration for package.json scripts
module.exports.scripts = {
  'build:analyze': 'ANALYZE=true npm run build',
  'build:profile': 'npm run build -- --profile',
  'build:cache-check': 'node scripts/cache-validation.js',
};

// Helper function to validate cache configuration
module.exports.validateCacheConfig = () => {
  const fs = require('fs');
  const path = require('path');
  
  console.log('🔍 Validating cache configuration...');
  
  // Check if service worker exists
  const swPath = path.join(__dirname, 'public', 'sw.js');
  if (!fs.existsSync(swPath)) {
    console.warn('⚠️  Service worker not found at public/sw.js');
  } else {
    console.log('✅ Service worker found');
  }
  
  // Check build output for proper hashing
  const buildPath = path.join(__dirname, 'build');
  if (fs.existsSync(buildPath)) {
    const files = fs.readdirSync(buildPath, { recursive: true });
    const hashedFiles = files.filter(file => /\.[a-f0-9]{8,}\./i.test(file));
    
    console.log(`✅ Found ${hashedFiles.length} content-hashed files`);
    
    if (hashedFiles.length === 0) {
      console.warn('⚠️  No content-hashed files found in build output');
    }
  }
  
  console.log('✅ Cache configuration validation complete');
};