# Testing Tools for Local Model Development

This folder contains testing and debugging tools that were used during the development and optimization of the local model system. These tools are not required for normal application operation but can be useful for debugging performance issues.

## 🧪 **Testing Scripts**

### `test-local-model.js`
Standalone Node.js tester for raw `node-llama-cpp` performance without Electron overhead.

**Usage:**
```bash
node test-local-model.js [model-path] [test-type]
```

**Test Types:**
- `load` - Test model loading performance
- `inference` - Test inference performance 
- `memory` - Test memory usage patterns
- `stress` - Stress test with multiple requests
- `all` - Run all tests (default)

### `test-electron-local.js`
Minimal Electron app with GUI for testing IPC communication between renderer and main process.

**Usage:**
```bash
node test-electron-local.js
```

### `performance-monitor.js`
System resource monitor that tracks CPU, memory usage, and identifies bottlenecks during model operations.

**Usage:**
```bash
node performance-monitor.js
```

### `run-tests.js`
Automated test runner that orchestrates all the above tests and generates comprehensive reports.

**Usage:**
```bash
node run-tests.js [model-path]
```

## 📊 **Test Reports**

- `performance-report-*.json` - Detailed performance metrics
- `test-report-*.json` - Test execution summaries

## 📖 **Documentation**

### `testing-guide.md`
Comprehensive guide explaining how to use all the testing tools, interpret results, and debug common issues.

## ⚠️ **Note**

These tools were instrumental in achieving the optimized local model performance (2.6GB memory usage, 37+ tokens/sec) but are not needed for normal application usage. They're preserved here for future debugging and development work. 