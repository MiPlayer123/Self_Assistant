# Local Model Performance Testing Guide

This guide helps you debug performance issues with local models by providing isolated testing tools outside of the main application.

## 🧪 Testing Tools Overview

### 1. **Standalone Node.js Tester** (`test-local-model.js`)
Tests the raw node-llama-cpp performance without Electron overhead.

### 2. **Electron Test App** (`test-electron-local.js`)
Tests the IPC communication and Electron integration with a minimal UI.

### 3. **Performance Monitor** (`performance-monitor.js`)
Monitors system resources during testing to identify bottlenecks.

---

## 🚀 Quick Start

### Prerequisites
```bash
# Ensure you have the dependencies
npm install node-llama-cpp electron
```

### Basic Testing Workflow

1. **Start Performance Monitoring** (in terminal 1):
```bash
node performance-monitor.js 300 1000
```

2. **Run Standalone Test** (in terminal 2):
```bash
node test-local-model.js /path/to/your/model.gguf all
```

3. **Analyze Results** - The monitor will show real-time metrics and save a detailed report.

---

## 📋 Detailed Testing Instructions

### Test 1: Raw Performance (Node.js Only)

This tests the basic node-llama-cpp performance without any Electron overhead:

```bash
# Test model loading only
node test-local-model.js /path/to/model.gguf load

# Test inference performance
node test-local-model.js /path/to/model.gguf inference

# Test memory patterns
node test-local-model.js /path/to/model.gguf memory

# Stress test
node test-local-model.js /path/to/model.gguf stress

# Run all tests
node test-local-model.js /path/to/model.gguf all
```

**What to look for:**
- **Loading Time**: Should complete within reasonable time (varies by model size)
- **Memory Usage**: Should not exceed available system memory
- **Inference Speed**: Check tokens/second for acceptable performance
- **Memory Leaks**: Memory should stabilize after loading

### Test 2: Electron Integration

This tests the IPC communication and Electron-specific issues:

```bash
# Start the Electron test app
electron test-electron-local.js
```

**What to test:**
1. Select your model file using the file picker
2. Click "Test Model Loading" - watch progress and memory usage
3. Click "Test Inference" - check response time and streaming
4. Run "Stress Test" to check for degradation over time
5. Monitor real-time metrics in the UI

**What to look for:**
- **Progress Updates**: Should show smooth loading progress
- **Memory Growth**: Process memory should not grow excessively
- **Response Time**: First token time and total inference time
- **UI Responsiveness**: Interface should not freeze during operations

### Test 3: Performance Monitoring

Run this alongside your tests to identify bottlenecks:

```bash
# Monitor for 5 minutes with 1-second intervals
node performance-monitor.js 300 1000

# Monitor with high frequency for detailed analysis
node performance-monitor.js 60 500

# Monitor another process (like your main app)
node performance-monitor.js monitor-pid 1234
```

**What to analyze:**
- **CPU Spikes**: Look for periods of high CPU usage
- **Memory Growth**: Identify memory leaks or excessive usage
- **System Impact**: Overall system performance during model operations

---

## 🔍 Troubleshooting Common Issues

### Issue: Computer Freezes During Model Loading

**Symptoms:**
- System becomes unresponsive
- High CPU/memory usage
- Long loading times

**Debug Steps:**
1. Run standalone test first:
   ```bash
   node test-local-model.js /path/to/model.gguf load
   ```
2. Monitor with high frequency:
   ```bash
   node performance-monitor.js 60 500
   ```
3. Check model size vs available memory
4. Try smaller models first

**Possible Causes:**
- Model too large for available RAM
- CPU overcommitment
- Disk I/O bottleneck

### Issue: Slow Response Times

**Symptoms:**
- High latency before first token
- Low tokens/second rate
- UI feels sluggish

**Debug Steps:**
1. Test raw inference performance:
   ```bash
   node test-local-model.js /path/to/model.gguf inference
   ```
2. Compare Electron vs Node.js performance
3. Check CPU/memory usage during inference

**Possible Causes:**
- Insufficient CPU/GPU resources
- Memory swapping
- IPC communication overhead
- Context window too large

### Issue: Memory Leaks

**Symptoms:**
- Memory usage continuously grows
- System becomes slower over time
- Eventually runs out of memory

**Debug Steps:**
1. Run memory pattern test:
   ```bash
   node test-local-model.js /path/to/model.gguf memory
   ```
2. Monitor memory growth:
   ```bash
   node performance-monitor.js 600 2000
   ```
3. Check model disposal in Electron test

**Possible Causes:**
- Models not properly disposed
- Context not cleaned up
- Event listeners not removed

---

## 📊 Interpreting Test Results

### Performance Benchmarks

**Model Loading:**
- ✅ Good: < 30 seconds for 4GB model
- ⚠️ Acceptable: 30-60 seconds
- ❌ Poor: > 60 seconds

**Inference Speed:**
- ✅ Good: > 10 tokens/second
- ⚠️ Acceptable: 5-10 tokens/second  
- ❌ Poor: < 5 tokens/second

**Memory Usage:**
- ✅ Good: Model size + 1-2GB overhead
- ⚠️ Acceptable: Model size + 2-4GB overhead
- ❌ Poor: > Model size + 4GB overhead

**CPU Usage:**
- ✅ Good: < 80% sustained
- ⚠️ Acceptable: 80-95% sustained
- ❌ Poor: > 95% sustained

### Red Flags

🚨 **Immediate Issues:**
- CPU usage > 95% for extended periods
- Memory usage > 90% of available RAM
- Loading times > 2 minutes for 4GB models
- Inference speed < 2 tokens/second

⚠️ **Warning Signs:**
- Memory growth > 100MB per inference cycle
- CPU spikes causing system freezes
- Inconsistent performance between runs

---

## 🛠️ Optimization Recommendations

### If Models Load Too Slowly:
1. **Check Available RAM**: Ensure 2x model size available
2. **Use SSD Storage**: Model loading is I/O intensive
3. **Close Other Apps**: Free up system resources
4. **Try Smaller Models**: Start with quantized versions

### If Inference Is Too Slow:
1. **Reduce Context Length**: Smaller context = faster inference
2. **Lower Temperature**: Reduces computation complexity
3. **Reduce Max Tokens**: Limit response length
4. **Check CPU**: Ensure adequate processing power

### If System Freezes:
1. **Increase Virtual Memory**: Set larger page file
2. **Close Background Apps**: Free up resources  
3. **Use Smaller Models**: Reduce memory pressure
4. **Add RAM**: Hardware upgrade may be needed

---

## 📁 Generated Files

The testing tools create several output files:

- `performance-report-[timestamp].json` - Detailed performance data
- `test-local-model.html` - Temporary test interface (auto-deleted)
- `test-preload.js` - Temporary preload script (auto-deleted)

### Analyzing Saved Reports

```bash
# Analyze a previous performance report
node performance-monitor.js analyze performance-report-1234567890.json
```

---

## 🔧 Advanced Configuration

### Environment Variables

```bash
# Enable garbage collection for memory testing
export NODE_OPTIONS="--expose-gc"

# Increase memory limit for large models
export NODE_OPTIONS="--max-old-space-size=8192"

# Enable detailed memory tracking
export UV_THREADPOOL_SIZE=16
```

### Model Optimization Settings

For testing, try these configurations:

```javascript
// Conservative settings for testing
{
  temperature: 0.1,
  maxTokens: 100,
  contextLength: 2048
}

// Performance settings
{
  temperature: 0.7,
  maxTokens: 50,
  contextLength: 1024
}
```

---

## 📞 Getting Help

If you're still experiencing issues after testing:

1. **Share Test Results**: Include performance monitor reports
2. **System Specs**: CPU, RAM, storage type, OS
3. **Model Details**: Size, quantization, source
4. **Error Logs**: Console output from failed tests

The isolated testing approach should help identify whether issues are:
- **Hardware Related**: CPU/memory insufficient
- **Model Related**: Model too large or corrupted
- **Code Related**: Implementation bugs
- **Integration Related**: Electron/IPC issues

This systematic approach will help pinpoint the exact cause of performance problems and guide appropriate solutions. 