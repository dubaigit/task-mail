const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  // Performance optimization configuration for MainDashboard
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendor chunk for stable caching
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
          maxSize: 50000 // 50KB max vendor chunk
        },
        
        // Dashboard-specific chunks
        mainDashboard: {
          test: /[\\/]src[\\/]components[\\/]MainDashboard[\\/]/,
          name: 'main-dashboard',
          chunks: 'all',
          priority: 8,
          maxSize: 30000 // 30KB for MainDashboard core
        },
        
        // Task management chunk
        tasks: {
          test: /[\\/]src[\\/]components[\\/]TaskCentric[\\/]/,
          name: 'task-management',
          chunks: 'async',
          priority: 6,
          maxSize: 40000 // 40KB for task components
        },
        
        // Email components chunk
        email: {
          test: /[\\/]src[\\/]components[\\/]Email[\\/]/,
          name: 'email-components',
          chunks: 'async',
          priority: 6,
          maxSize: 35000 // 35KB for email components
        },
        
        // Analytics chunk
        analytics: {
          test: /[\\/]src[\\/]components[\\/]Analytics[\\/]/,
          name: 'analytics',
          chunks: 'async',
          priority: 6,
          maxSize: 30000 // 30KB for analytics
        },
        
        // AI components chunk
        ai: {
          test: /[\\/]src[\\/]components[\\/]AI(Assistant)?[\\/]/,
          name: 'ai-components',
          chunks: 'async',
          priority: 6,
          maxSize: 40000 // 40KB for AI components
        },
        
        // UI components chunk (shared)
        ui: {
          test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
          name: 'ui-components',
          chunks: 'all',
          priority: 7,
          maxSize: 25000 // 25KB for UI components
        },
        
        // Stores chunk
        stores: {
          test: /[\\/]src[\\/]stores[\\/]/,
          name: 'app-stores',
          chunks: 'all',
          priority: 7,
          maxSize: 20000 // 20KB for stores
        },
        
        // Utils and hooks chunk
        utils: {
          test: /[\\/]src[\\/](utils|hooks)[\\/]/,
          name: 'app-utils',
          chunks: 'all',
          priority: 7,
          maxSize: 15000 // 15KB for utils and hooks
        }
      }
    },
    
    // Minimize bundle size
    minimize: true,
    
    // Remove unused exports
    usedExports: true,
    sideEffects: false
  },
  
  // Performance budgets to enforce <200KB target
  performance: {
    maxAssetSize: 200000, // 200KB total
    maxEntrypointSize: 200000, // 200KB initial
    hints: 'error', // Fail build if exceeded
    assetFilter: (assetFilename) => {
      // Only check JS files for performance budgets
      return assetFilename.endsWith('.js');
    }
  },
  
  // Webpack plugins for bundle optimization
  plugins: [
    // Bundle analyzer (only in development or when ANALYZE=true)
    ...(process.env.NODE_ENV === 'development' || process.env.ANALYZE ? [
      new BundleAnalyzerPlugin({
        analyzerMode: process.env.ANALYZE === 'server' ? 'server' : 'static',
        openAnalyzer: false,
        reportFilename: path.resolve(__dirname, 'bundle-report.html'),
        statsFilename: path.resolve(__dirname, 'bundle-stats.json'),
        generateStatsFile: true
      })
    ] : [])
  ],
  
  // Resolve optimizations
  resolve: {
    // Module resolution optimizations
    modules: ['node_modules', path.resolve(__dirname, 'src')],
    
    // Prefer ES modules for better tree shaking
    mainFields: ['module', 'main'],
    
    // Common extensions
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    
    // Alias for shorter imports and better bundling
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@types': path.resolve(__dirname, 'src/types')
    }
  },
  
  // Module rules for optimizations
  module: {
    rules: [
      // Tree shaking for lodash
      {
        test: /[\\/]node_modules[\\/]lodash[\\/]/,
        sideEffects: false
      },
      
      // CSS modules for better code splitting
      {
        test: /\.module\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]___[hash:base64:5]'
              }
            }
          }
        ]
      }
    ]
  },
  
  // Development optimizations
  ...(process.env.NODE_ENV === 'development' && {
    devtool: 'eval-cheap-module-source-map', // Faster rebuilds
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
      compression: 'gzip'
    }
  })
};

// Performance monitoring utilities
const performanceUtils = {
  // Calculate current bundle size
  calculateBundleSize: async (statsPath = './bundle-stats.json') => {
    try {
      const fs = require('fs').promises;
      const stats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
      
      let totalSize = 0;
      stats.assets.forEach(asset => {
        if (asset.name.endsWith('.js')) {
          totalSize += asset.size;
        }
      });
      
      return {
        totalSize,
        sizeInKB: Math.round(totalSize / 1024),
        isUnderBudget: totalSize < 200000,
        percentageOfBudget: Math.round((totalSize / 200000) * 100)
      };
    } catch (error) {
      console.warn('Could not calculate bundle size:', error.message);
      return null;
    }
  },
  
  // Generate performance report
  generateReport: async () => {
    const bundleInfo = await performanceUtils.calculateBundleSize();
    if (!bundleInfo) return;
    
    console.log('\n📊 MainDashboard Bundle Performance Report');
    console.log('==========================================');
    console.log(`Total Bundle Size: ${bundleInfo.sizeInKB} KB`);
    console.log(`Budget Usage: ${bundleInfo.percentageOfBudget}%`);
    console.log(`Status: ${bundleInfo.isUnderBudget ? '✅ Under Budget' : '❌ Over Budget'}`);
    console.log(`Target: 200 KB`);
    
    if (bundleInfo.percentageOfBudget > 80) {
      console.log('\n⚠️  Warning: Approaching bundle size limit!');
      console.log('Consider:');
      console.log('- Further code splitting');
      console.log('- Lazy loading more components');
      console.log('- Removing unused dependencies');
    }
    
    if (!bundleInfo.isUnderBudget) {
      console.log('\n🚨 Bundle size exceeds 200KB target!');
      process.exit(1); // Fail the build
    }
  }
};

// Export utilities for use in build scripts
module.exports.performanceUtils = performanceUtils;