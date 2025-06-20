#!/usr/bin/env node
/**
 * Test Runner for Local Model Performance
 * 
 * This script provides a simple interface to run all performance tests
 * and automatically collect and analyze results.
 * 
 * Usage: node run-tests.js [model-path]
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const readline = require('readline');

class TestRunner {
  constructor() {
    this.modelPath = null;
    this.testResults = {};
    this.monitorProcess = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  log(message, color = '\x1b[0m') {
    const timestamp = new Date().toISOString();
    console.log(`${color}[${timestamp}] ${message}\x1b[0m`);
  }

  async askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async selectModel() {
    if (process.argv[2]) {
      this.modelPath = process.argv[2];
      if (!fs.existsSync(this.modelPath)) {
        this.log(`❌ Model file not found: ${this.modelPath}`, '\x1b[31m');
        process.exit(1);
      }
    } else {
      this.log('🔍 Model Selection', '\x1b[36m');
      this.modelPath = await this.askQuestion('Enter path to your .gguf model file: ');
      
      if (!fs.existsSync(this.modelPath)) {
        this.log(`❌ Model file not found: ${this.modelPath}`, '\x1b[31m');
        process.exit(1);
      }
    }
    
    const stats = fs.statSync(this.modelPath);
    const sizeMB = Math.round(stats.size / 1024 / 1024);
    this.log(`✅ Selected model: ${path.basename(this.modelPath)} (${sizeMB} MB)`, '\x1b[32m');
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      this.log(`🔄 Running: ${command} ${args.join(' ')}`, '\x1b[33m');
      
      const child = spawn(command, args, {
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });
      
      let output = '';
      
      if (options.silent) {
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          output += data.toString();
        });
      }
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async startPerformanceMonitor() {
    this.log('📊 Starting performance monitor...', '\x1b[36m');
    
    this.monitorProcess = spawn('node', ['performance-monitor.js', '600', '1000'], {
      stdio: 'pipe'
    });
    
    this.monitorProcess.stdout.on('data', (data) => {
      // Capture monitor output for later analysis
      const output = data.toString();
      if (output.includes('CPU:') || output.includes('Performance Monitor')) {
        process.stdout.write(`📊 ${output}`);
      }
    });
    
    // Give monitor time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async stopPerformanceMonitor() {
    if (this.monitorProcess) {
      this.log('⏹️ Stopping performance monitor...', '\x1b[36m');
      this.monitorProcess.kill('SIGINT');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async runStandaloneTests() {
    this.log('🧪 Running standalone Node.js tests...', '\x1b[36m');
    
    const tests = ['load', 'inference', 'memory'];
    
    for (const test of tests) {
      try {
        this.log(`\n--- Testing: ${test} ---`, '\x1b[35m');
        await this.runCommand('node', ['test-local-model.js', this.modelPath, test]);
        this.testResults[`standalone_${test}`] = { success: true };
      } catch (error) {
        this.log(`❌ Test ${test} failed: ${error.message}`, '\x1b[31m');
        this.testResults[`standalone_${test}`] = { success: false, error: error.message };
      }
    }
  }

  async runElectronTest() {
    this.log('\n🔬 Starting Electron test app...', '\x1b[36m');
    this.log('📝 Please perform the following tests manually:', '\x1b[33m');
    this.log('   1. Select your model file');
    this.log('   2. Click "Test Model Loading"');
    this.log('   3. Click "Test Inference"');
    this.log('   4. Run "Stress Test"');
    this.log('   5. Monitor the real-time metrics');
    this.log('   6. Close the app when done');
    
    try {
      await this.runCommand('electron', ['test-electron-local.js']);
      this.testResults.electron = { success: true };
    } catch (error) {
      this.log(`❌ Electron test failed: ${error.message}`, '\x1b[31m');
      this.testResults.electron = { success: false, error: error.message };
    }
  }

  async generateReport() {
    this.log('\n📋 Generating test report...', '\x1b[36m');
    
    const reportData = {
      timestamp: new Date().toISOString(),
      modelPath: this.modelPath,
      modelSize: fs.statSync(this.modelPath).size,
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpuCount: require('os').cpus().length,
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) + ' GB'
      },
      testResults: this.testResults
    };
    
    const reportFile = `test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    
    this.log('\n📊 TEST SUMMARY', '\x1b[36m');
    this.log('================', '\x1b[36m');
    
    const successful = Object.values(this.testResults).filter(r => r.success).length;
    const total = Object.keys(this.testResults).length;
    
    this.log(`✅ Successful tests: ${successful}/${total}`, '\x1b[32m');
    
    if (successful < total) {
      this.log('\n❌ Failed tests:', '\x1b[31m');
      Object.entries(this.testResults).forEach(([test, result]) => {
        if (!result.success) {
          this.log(`   - ${test}: ${result.error}`, '\x1b[31m');
        }
      });
    }
    
    this.log(`\n📄 Detailed report saved: ${reportFile}`, '\x1b[32m');
    
    // Look for performance reports
    const perfReports = fs.readdirSync('.').filter(f => f.startsWith('performance-report-'));
    if (perfReports.length > 0) {
      const latestReport = perfReports.sort().pop();
      this.log(`📊 Performance report: ${latestReport}`, '\x1b[32m');
      
      // Quick analysis
      try {
        await this.runCommand('node', ['performance-monitor.js', 'analyze', latestReport], { silent: false });
      } catch (error) {
        this.log(`⚠️ Could not analyze performance report: ${error.message}`, '\x1b[33m');
      }
    }
  }

  async showRecommendations() {
    this.log('\n💡 RECOMMENDATIONS', '\x1b[36m');
    this.log('==================', '\x1b[36m');
    
    const failed = Object.entries(this.testResults).filter(([_, result]) => !result.success);
    
    if (failed.length === 0) {
      this.log('🎉 All tests passed! Your local model setup appears to be working well.', '\x1b[32m');
      return;
    }
    
    this.log('Based on failed tests, here are some recommendations:', '\x1b[33m');
    
    failed.forEach(([test, result]) => {
      if (test.includes('load')) {
        this.log('\n🔧 Model Loading Issues:', '\x1b[33m');
        this.log('   - Ensure you have enough RAM (2x model size recommended)');
        this.log('   - Close other applications to free memory');
        this.log('   - Try a smaller/quantized model first');
        this.log('   - Check if your storage drive has enough free space');
      }
      
      if (test.includes('inference')) {
        this.log('\n🔧 Inference Performance Issues:', '\x1b[33m');
        this.log('   - Reduce context length and max tokens');
        this.log('   - Lower temperature setting');
        this.log('   - Ensure CPU is not throttling due to heat');
        this.log('   - Consider a more powerful CPU or GPU acceleration');
      }
      
      if (test.includes('memory')) {
        this.log('\n🔧 Memory Issues:', '\x1b[33m');
        this.log('   - Monitor for memory leaks in main application');
        this.log('   - Ensure proper model disposal');
        this.log('   - Increase virtual memory/swap file size');
        this.log('   - Consider upgrading system RAM');
      }
    });
    
    this.log('\n📚 For detailed guidance, see: testing-guide.md', '\x1b[36m');
  }

  async run() {
    console.log(`
🧪 Local Model Performance Test Runner
=====================================

This tool will run comprehensive tests to identify performance issues
with your local model setup.

Tests included:
✅ Raw Node.js performance
✅ Electron integration
✅ Performance monitoring
✅ Automated analysis

`);

    try {
      await this.selectModel();
      
      const runElectron = await this.askQuestion('\nRun interactive Electron test? (y/n) [y]: ');
      const shouldRunElectron = runElectron.toLowerCase() !== 'n';
      
      // Start performance monitoring
      await this.startPerformanceMonitor();
      
      // Run standalone tests
      await this.runStandaloneTests();
      
      // Run Electron test if requested
      if (shouldRunElectron) {
        await this.runElectronTest();
      }
      
      // Stop monitoring and generate report
      await this.stopPerformanceMonitor();
      await this.generateReport();
      await this.showRecommendations();
      
    } catch (error) {
      this.log(`❌ Test run failed: ${error.message}`, '\x1b[31m');
    } finally {
      this.rl.close();
    }
  }
}

// Check if required files exist
const requiredFiles = ['test-local-model.js', 'performance-monitor.js', 'test-electron-local.js'];
const missing = requiredFiles.filter(file => !fs.existsSync(file));

if (missing.length > 0) {
  console.error(`❌ Missing required files: ${missing.join(', ')}`);
  console.error('Please ensure all test files are in the current directory.');
  process.exit(1);
}

// Run the test suite
const runner = new TestRunner();
runner.run().then(() => {
  console.log('\n🏁 Test run completed!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test run failed:', error);
  process.exit(1);
}); 