#!/usr/bin/env node
/**
 * Standalone Local Model Performance Test
 * 
 * This script tests local model loading, inference, and memory management
 * without the full Electron app to help debug performance issues.
 * 
 * Usage:
 *   node test-local-model.js [model-path] [test-type]
 * 
 * Test types:
 *   - load: Test model loading performance
 *   - inference: Test inference performance 
 *   - memory: Test memory usage patterns
 *   - stress: Stress test with multiple requests
 *   - all: Run all tests
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

class LocalModelTester {
  constructor() {
    this.llama = null;
    this.model = null;
    this.context = null;
    this.modelPath = null;
    this.startTime = null;
    this.memoryBaseline = null;
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  logMemoryUsage(label = 'Memory Usage') {
    const usage = process.memoryUsage();
    const systemMem = {
      total: Math.round(os.totalmem() / 1024 / 1024),
      free: Math.round(os.freemem() / 1024 / 1024),
      used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
    };
    
    this.log(`${label}:`, {
      process: {
        rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(usage.external / 1024 / 1024) + ' MB'
      },
      system: {
        total: systemMem.total + ' MB',
        free: systemMem.free + ' MB',
        used: systemMem.used + ' MB'
      }
    });

    return usage;
  }

  logCPUUsage(label = 'CPU Usage') {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    this.log(`${label}:`, {
      cores: cpus.length,
      model: cpus[0].model,
      loadAverage: {
        '1min': loadAvg[0].toFixed(2),
        '5min': loadAvg[1].toFixed(2),
        '15min': loadAvg[2].toFixed(2)
      }
    });
  }

  async initializeLlama() {
    this.log('Initializing node-llama-cpp...');
    this.startTime = Date.now();
    
    try {
      const { getLlama } = await import('node-llama-cpp');
      this.llama = await getLlama();
      const initTime = Date.now() - this.startTime;
      this.log(`✅ node-llama-cpp initialized in ${initTime}ms`);
      return true;
    } catch (error) {
      this.log('❌ Failed to initialize node-llama-cpp:', error.message);
      return false;
    }
  }

  async testModelLoading(modelPath) {
    this.log(`\n🧪 Testing Model Loading: ${modelPath}`);
    this.logMemoryUsage('Pre-load Memory');
    this.logCPUUsage('Pre-load CPU');
    
    this.startTime = Date.now();
    
    try {
      // Test if file exists and get size
      const stats = fs.statSync(modelPath);
      this.log(`Model file size: ${Math.round(stats.size / 1024 / 1024)} MB`);
      
      // Load model with progress tracking
      let lastProgress = 0;
      this.model = await this.llama.loadModel({
        modelPath: modelPath,
        onLoadProgress: (progress) => {
          if (progress - lastProgress >= 0.1) { // Log every 10%
            this.log(`Loading progress: ${Math.round(progress * 100)}%`);
            this.logMemoryUsage('During Load');
            lastProgress = progress;
          }
        }
      });

      const loadTime = Date.now() - this.startTime;
      this.log(`✅ Model loaded successfully in ${loadTime}ms`);
      this.logMemoryUsage('Post-load Memory');
      this.logCPUUsage('Post-load CPU');
      
      return { success: true, loadTime };
    } catch (error) {
      this.log('❌ Model loading failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testContextCreation() {
    this.log('\n🧪 Testing Context Creation');
    this.startTime = Date.now();
    this.logMemoryUsage('Pre-context Memory');
    
    try {
      this.context = await this.model.createContext();
      const contextTime = Date.now() - this.startTime;
      this.log(`✅ Context created successfully in ${contextTime}ms`);
      this.logMemoryUsage('Post-context Memory');
      
      return { success: true, contextTime };
    } catch (error) {
      this.log('❌ Context creation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testInference(prompt = "Hello, how are you?", maxTokens = 50) {
    this.log(`\n🧪 Testing Inference with prompt: "${prompt}"`);
    this.logMemoryUsage('Pre-inference Memory');
    this.logCPUUsage('Pre-inference CPU');
    
    this.startTime = Date.now();
    let chunkCount = 0;
    let totalTokens = 0;
    
    try {
      const { LlamaChatSession } = await import('node-llama-cpp');
      const session = new LlamaChatSession({
        contextSequence: this.context.getSequence()
      });

      const response = await session.prompt(prompt, {
        temperature: 0.7,
        maxTokens: maxTokens,
        onTextChunk: (chunk) => {
          chunkCount++;
          totalTokens += chunk.length;
          
          if (chunkCount === 1) {
            const timeToFirstToken = Date.now() - this.startTime;
            this.log(`⚡ Time to first token: ${timeToFirstToken}ms`);
          }
          
          if (chunkCount % 10 === 0) { // Log every 10 chunks
            this.logMemoryUsage(`During Inference (chunk ${chunkCount})`);
          }
        }
      });

      const totalTime = Date.now() - this.startTime;
      const tokensPerSecond = totalTokens / (totalTime / 1000);
      
      this.log(`✅ Inference completed:`, {
        totalTime: totalTime + 'ms',
        chunks: chunkCount,
        totalTokens,
        tokensPerSecond: tokensPerSecond.toFixed(2),
        response: response.substring(0, 100) + (response.length > 100 ? '...' : '')
      });
      
      this.logMemoryUsage('Post-inference Memory');
      this.logCPUUsage('Post-inference CPU');
      
      return { 
        success: true, 
        totalTime, 
        chunkCount, 
        totalTokens, 
        tokensPerSecond,
        response 
      };
    } catch (error) {
      this.log('❌ Inference failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testModelUnloading() {
    this.log('\n🧪 Testing Model Unloading');
    this.logMemoryUsage('Pre-unload Memory');
    
    try {
      if (this.context) {
        this.context.dispose();
        this.context = null;
        this.log('✅ Context disposed');
      }
      
      if (this.model) {
        this.model.dispose();
        this.model = null;
        this.log('✅ Model disposed');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.log('🗑️ Garbage collection triggered');
      }
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.logMemoryUsage('Post-unload Memory');
      return { success: true };
    } catch (error) {
      this.log('❌ Model unloading failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testStress(iterations = 5) {
    this.log(`\n🧪 Stress Testing (${iterations} iterations)`);
    const results = [];
    
    for (let i = 1; i <= iterations; i++) {
      this.log(`\n--- Iteration ${i}/${iterations} ---`);
      const prompt = `Iteration ${i}: Tell me a short fact.`;
      
      const result = await this.testInference(prompt, 30);
      results.push(result);
      
      if (i < iterations) {
        this.log('Waiting 2 seconds before next iteration...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Analyze results
    const successful = results.filter(r => r.success);
    if (successful.length > 0) {
      const avgTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
      const avgTokensPerSec = successful.reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.length;
      
      this.log('\n📊 Stress Test Results:', {
        successfulIterations: successful.length,
        failedIterations: results.length - successful.length,
        averageTime: Math.round(avgTime) + 'ms',
        averageTokensPerSecond: avgTokensPerSec.toFixed(2)
      });
    }
    
    return results;
  }

  async runTest(modelPath, testType = 'all') {
    this.log(`🚀 Starting Local Model Performance Test`);
    this.log(`Model: ${modelPath}`);
    this.log(`Test Type: ${testType}`);
    this.log(`Node.js: ${process.version}`);
    this.log(`Platform: ${process.platform} ${process.arch}`);
    
    this.memoryBaseline = this.logMemoryUsage('Baseline Memory');
    this.logCPUUsage('Baseline CPU');
    
    // Initialize
    const initSuccess = await this.initializeLlama();
    if (!initSuccess) return;
    
    try {
      // Test model loading
      if (testType === 'all' || testType === 'load') {
        const loadResult = await this.testModelLoading(modelPath);
        if (!loadResult.success) return;
        
        const contextResult = await this.testContextCreation();
        if (!contextResult.success) return;
      }
      
      // Test inference
      if (testType === 'all' || testType === 'inference') {
        if (!this.model || !this.context) {
          await this.testModelLoading(modelPath);
          await this.testContextCreation();
        }
        await this.testInference();
      }
      
      // Test memory patterns
      if (testType === 'all' || testType === 'memory') {
        if (!this.model || !this.context) {
          await this.testModelLoading(modelPath);
          await this.testContextCreation();
        }
        
        this.log('\n🧪 Memory Pattern Test');
        for (let i = 1; i <= 3; i++) {
          await this.testInference(`Memory test ${i}`, 20);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Stress test
      if (testType === 'all' || testType === 'stress') {
        if (!this.model || !this.context) {
          await this.testModelLoading(modelPath);
          await this.testContextCreation();
        }
        await this.testStress(5);
      }
      
      // Test unloading
      if (testType === 'all') {
        await this.testModelUnloading();
      }
      
    } catch (error) {
      this.log('❌ Test failed with error:', error.message);
      console.error(error);
    } finally {
      this.log('\n🏁 Test completed');
      this.logMemoryUsage('Final Memory');
    }
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const modelPath = args[0];
  const testType = args[1] || 'all';
  
  if (!modelPath) {
    console.log(`
Usage: node test-local-model.js [model-path] [test-type]

Test types:
  - load: Test model loading performance
  - inference: Test inference performance 
  - memory: Test memory usage patterns
  - stress: Stress test with multiple requests
  - all: Run all tests (default)

Example:
  node test-local-model.js ./models/model.gguf inference
`);
    process.exit(1);
  }
  
  if (!fs.existsSync(modelPath)) {
    console.error(`❌ Model file not found: ${modelPath}`);
    process.exit(1);
  }
  
  const tester = new LocalModelTester();
  await tester.runTest(modelPath, testType);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LocalModelTester; 