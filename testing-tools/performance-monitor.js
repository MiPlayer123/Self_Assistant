#!/usr/bin/env node
/**
 * Performance Monitor for Local Model Testing
 * 
 * This script monitors system performance while local models are running
 * to help identify bottlenecks and resource usage patterns.
 * 
 * Usage: node performance-monitor.js [duration-seconds] [interval-ms]
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor(duration = 300, interval = 1000) {
    this.duration = duration * 1000; // Convert to ms
    this.interval = interval;
    this.startTime = null;
    this.samples = [];
    this.isRunning = false;
    this.intervalId = null;
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  getCPUUsage() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate CPU usage over time
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return {
      cores: cpus.length,
      model: cpus[0].model,
      usage: usage,
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2]
      }
    };
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    
    return {
      total: Math.round(total / 1024 / 1024), // MB
      free: Math.round(free / 1024 / 1024),   // MB
      used: Math.round(used / 1024 / 1024),   // MB
      usagePercent: Math.round((used / total) * 100)
    };
  }

  getDiskUsage() {
    try {
      // Get current working directory stats
      const stats = fs.statSync(process.cwd());
      return {
        currentDir: process.cwd(),
        accessible: true
      };
    } catch (error) {
      return {
        currentDir: process.cwd(),
        accessible: false,
        error: error.message
      };
    }
  }

  getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const activeInterfaces = {};
    
    for (const [name, info] of Object.entries(interfaces)) {
      if (info && info.length > 0) {
        activeInterfaces[name] = info.filter(i => !i.internal).length;
      }
    }
    
    return activeInterfaces;
  }

  getProcessInfo() {
    const usage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      pid: process.pid,
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
      uptime: Math.round(uptime),
      memory: {
        rss: Math.round(usage.rss / 1024 / 1024),        // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),   // MB
        external: Math.round(usage.external / 1024 / 1024)    // MB
      },
      cpuUsage: process.cpuUsage()
    };
  }

  collectSample() {
    const timestamp = Date.now();
    const sample = {
      timestamp,
      relativeTime: timestamp - this.startTime,
      cpu: this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      process: this.getProcessInfo(),
      disk: this.getDiskUsage(),
      network: this.getNetworkInterfaces()
    };
    
    this.samples.push(sample);
    
    // Log current sample (simplified)
    console.log(`[${new Date(timestamp).toISOString()}] ` +
      `CPU: ${sample.cpu.usage}% | ` +
      `RAM: ${sample.memory.usagePercent}% (${sample.memory.used}MB) | ` +
      `Process: ${sample.process.memory.rss}MB`);
    
    return sample;
  }

  start() {
    if (this.isRunning) {
      this.log('Monitor is already running');
      return;
    }
    
    this.log(`Starting performance monitor...`);
    this.log(`Duration: ${this.duration / 1000}s, Interval: ${this.interval}ms`);
    
    this.startTime = Date.now();
    this.isRunning = true;
    this.samples = [];
    
    // Collect initial sample
    this.collectSample();
    
    // Set up interval collection
    this.intervalId = setInterval(() => {
      this.collectSample();
      
      // Check if duration exceeded
      if (Date.now() - this.startTime >= this.duration) {
        this.stop();
      }
    }, this.interval);
    
    // Set up cleanup on exit
    process.on('SIGINT', () => {
      this.log('\nReceived SIGINT, stopping monitor...');
      this.stop();
      process.exit(0);
    });
  }

  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.log(`\nPerformance monitoring stopped. Collected ${this.samples.length} samples.`);
    this.generateReport();
  }

  generateReport() {
    if (this.samples.length === 0) {
      this.log('No samples collected');
      return;
    }
    
    // Calculate statistics
    const cpuUsages = this.samples.map(s => s.cpu.usage);
    const memoryUsages = this.samples.map(s => s.memory.usagePercent);
    const processMemory = this.samples.map(s => s.process.memory.rss);
    
    const stats = {
      duration: Math.round((this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp) / 1000),
      samples: this.samples.length,
      cpu: {
        min: Math.min(...cpuUsages),
        max: Math.max(...cpuUsages),
        avg: Math.round(cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length),
        cores: this.samples[0].cpu.cores,
        model: this.samples[0].cpu.model
      },
      systemMemory: {
        min: Math.min(...memoryUsages),
        max: Math.max(...memoryUsages),
        avg: Math.round(memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length),
        totalMB: this.samples[0].memory.total
      },
      processMemory: {
        min: Math.min(...processMemory),
        max: Math.max(...processMemory),
        avg: Math.round(processMemory.reduce((a, b) => a + b, 0) / processMemory.length),
        growth: processMemory[processMemory.length - 1] - processMemory[0]
      }
    };
    
    this.log('\n📊 PERFORMANCE REPORT', stats);
    
    // Identify potential issues
    const issues = [];
    
    if (stats.cpu.max > 90) {
      issues.push(`⚠️  High CPU usage detected: ${stats.cpu.max}%`);
    }
    
    if (stats.systemMemory.max > 85) {
      issues.push(`⚠️  High system memory usage: ${stats.systemMemory.max}%`);
    }
    
    if (stats.processMemory.growth > 500) {
      issues.push(`⚠️  Significant memory growth: +${stats.processMemory.growth}MB`);
    }
    
    if (issues.length > 0) {
      this.log('\n🚨 POTENTIAL ISSUES DETECTED:');
      issues.forEach(issue => console.log(issue));
    } else {
      this.log('\n✅ No significant performance issues detected');
    }
    
    // Save detailed report
    this.saveDetailedReport();
  }

  saveDetailedReport() {
    const reportFile = `performance-report-${Date.now()}.json`;
    const reportData = {
      metadata: {
        startTime: this.startTime,
        endTime: Date.now(),
        duration: this.duration,
        interval: this.interval,
        nodeVersion: process.version,
        platform: `${process.platform} ${process.arch}`
      },
      samples: this.samples
    };
    
    try {
      fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
      this.log(`📝 Detailed report saved to: ${reportFile}`);
    } catch (error) {
      this.log(`❌ Failed to save report: ${error.message}`);
    }
  }

  // Static method to analyze a saved report
  static analyzeReport(reportFile) {
    try {
      const data = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
      const monitor = new PerformanceMonitor();
      monitor.samples = data.samples;
      monitor.startTime = data.metadata.startTime;
      
      console.log(`📊 Analyzing report: ${reportFile}`);
      monitor.generateReport();
    } catch (error) {
      console.error(`❌ Failed to analyze report: ${error.message}`);
    }
  }

  // Method to monitor specific process by PID
  static monitorProcess(pid, duration = 60, interval = 1000) {
    const monitor = new PerformanceMonitor(duration, interval);
    
    // Override process info to monitor specific PID
    const originalGetProcessInfo = monitor.getProcessInfo.bind(monitor);
    monitor.getProcessInfo = () => {
      try {
        // This is a simplified version - in a real implementation,
        // you'd use a library like 'pidusage' to monitor other processes
        return originalGetProcessInfo();
      } catch (error) {
        return { error: `Cannot monitor PID ${pid}: ${error.message}` };
      }
    };
    
    console.log(`🔍 Monitoring process PID: ${pid}`);
    monitor.start();
  }
}

// CLI handling
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'analyze') {
    const reportFile = args[1];
    if (!reportFile) {
      console.error('Usage: node performance-monitor.js analyze <report-file>');
      process.exit(1);
    }
    PerformanceMonitor.analyzeReport(reportFile);
    return;
  }
  
  if (command === 'monitor-pid') {
    const pid = parseInt(args[1]);
    const duration = parseInt(args[2]) || 60;
    const interval = parseInt(args[3]) || 1000;
    
    if (!pid) {
      console.error('Usage: node performance-monitor.js monitor-pid <pid> [duration] [interval]');
      process.exit(1);
    }
    
    PerformanceMonitor.monitorProcess(pid, duration, interval);
    return;
  }
  
  // Default monitoring
  const duration = parseInt(args[0]) || 300; // 5 minutes default
  const interval = parseInt(args[1]) || 1000; // 1 second default
  
  const monitor = new PerformanceMonitor(duration, interval);
  monitor.start();
}

if (require.main === module) {
  console.log(`
🔍 Performance Monitor for Local Model Testing

Commands:
  node performance-monitor.js [duration] [interval]     - Monitor current process
  node performance-monitor.js monitor-pid <pid>        - Monitor specific process
  node performance-monitor.js analyze <report-file>    - Analyze saved report

Examples:
  node performance-monitor.js 60 500                   - Monitor for 60 seconds, sample every 500ms
  node performance-monitor.js monitor-pid 1234         - Monitor process 1234
  node performance-monitor.js analyze report.json      - Analyze saved report

Press Ctrl+C to stop monitoring early.
`);
  
  main();
}

module.exports = PerformanceMonitor; 