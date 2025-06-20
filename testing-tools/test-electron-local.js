/**
 * Minimal Electron App for Testing Local Model Performance
 * 
 * This creates a basic Electron app that only tests the local model
 * functionality to help isolate performance issues.
 * 
 * Usage: node test-electron-local.js
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import the local model handlers
let localModelHandlers;

class LocalModelElectronTester {
  constructor() {
    this.mainWindow = null;
    this.testResults = [];
  }

  async createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'test-preload.js')
      }
    });

    // Create a simple HTML test interface
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Local Model Performance Test</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            background: #1a1a1a; 
            color: #fff; 
        }
        .container { max-width: 800px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 15px; background: #2a2a2a; border-radius: 8px; }
        button { 
            padding: 10px 20px; 
            margin: 5px; 
            background: #4a90e2; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
        }
        button:hover { background: #357abd; }
        button:disabled { background: #666; cursor: not-allowed; }
        .log { 
            background: #000; 
            padding: 10px; 
            border-radius: 4px; 
            font-family: monospace; 
            height: 300px; 
            overflow-y: auto; 
            white-space: pre-wrap;
        }
        .metrics { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 10px; 
        }
        .metric { 
            background: #333; 
            padding: 10px; 
            border-radius: 4px; 
            text-align: center; 
        }
        .metric-value { font-size: 24px; color: #4a90e2; }
        .metric-label { font-size: 12px; color: #aaa; }
        input[type="file"] { margin: 10px 0; }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #333;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4a90e2, #357abd);
            width: 0%;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Local Model Performance Test</h1>
        
        <div class="section">
            <h3>Model Selection</h3>
            <input type="file" id="modelFile" accept=".gguf" />
            <div id="modelInfo"></div>
        </div>

        <div class="section">
            <h3>Test Controls</h3>
            <button id="testLoad">Test Model Loading</button>
            <button id="testInference">Test Inference</button>
            <button id="testStress">Stress Test (5x)</button>
            <button id="testUnload">Unload Model</button>
            <button id="clearLog">Clear Log</button>
            
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div id="progressText">Ready</div>
        </div>

        <div class="section">
            <h3>Real-time Metrics</h3>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value" id="memoryUsage">0 MB</div>
                    <div class="metric-label">Memory Usage</div>
                </div>
                <div class="metric">
                    <div class="metric-value" id="loadTime">0 ms</div>
                    <div class="metric-label">Load Time</div>
                </div>
                <div class="metric">
                    <div class="metric-value" id="inferenceTime">0 ms</div>
                    <div class="metric-label">Inference Time</div>
                </div>
                <div class="metric">
                    <div class="metric-value" id="tokensPerSec">0</div>
                    <div class="metric-label">Tokens/sec</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h3>Test Log</h3>
            <div class="log" id="testLog">Ready to test...\n</div>
        </div>
    </div>

    <script>
        let currentModelPath = null;
        let isModelLoaded = false;
        
        const log = (message) => {
            const timestamp = new Date().toISOString();
            const logElement = document.getElementById('testLog');
            logElement.textContent += \`[\${timestamp}] \${message}\\n\`;
            logElement.scrollTop = logElement.scrollHeight;
        };

        const updateProgress = (progress, message) => {
            document.getElementById('progressFill').style.width = \`\${progress}%\`;
            document.getElementById('progressText').textContent = message;
        };

        const updateMetric = (id, value) => {
            document.getElementById(id).textContent = value;
        };

        // File selection
        document.getElementById('modelFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                currentModelPath = file.path;
                const sizeMB = Math.round(file.size / 1024 / 1024);
                document.getElementById('modelInfo').innerHTML = \`
                    <strong>Selected:</strong> \${file.name}<br>
                    <strong>Size:</strong> \${sizeMB} MB<br>
                    <strong>Path:</strong> \${file.path}
                \`;
                log(\`Selected model: \${file.name} (\${sizeMB} MB)\`);
            }
        });

        // Test buttons
        document.getElementById('testLoad').addEventListener('click', async () => {
            if (!currentModelPath) {
                alert('Please select a model file first');
                return;
            }
            
            log('Starting load test...');
            updateProgress(0, 'Loading model...');
            
            try {
                const startTime = Date.now();
                const result = await window.electronAPI.loadLocalModel({ modelPath: currentModelPath });
                const loadTime = Date.now() - startTime;
                
                if (result.success) {
                    isModelLoaded = true;
                    updateProgress(100, 'Model loaded successfully');
                    updateMetric('loadTime', \`\${loadTime} ms\`);
                    log(\`✅ Model loaded successfully in \${loadTime}ms\`);
                } else {
                    updateProgress(0, 'Load failed');
                    log(\`❌ Load failed: \${result.error}\`);
                }
            } catch (error) {
                updateProgress(0, 'Load failed');
                log(\`❌ Load error: \${error.message}\`);
            }
        });

        document.getElementById('testInference').addEventListener('click', async () => {
            if (!currentModelPath) {
                alert('Please select a model file first');
                return;
            }
            
            log('Starting inference test...');
            updateProgress(0, 'Running inference...');
            
            try {
                const startTime = Date.now();
                let chunkCount = 0;
                
                // Set up chunk listener
                const removeChunkListener = window.electronAPI.addListener('localModelChunk', (data) => {
                    chunkCount++;
                    if (chunkCount === 1) {
                        const timeToFirstToken = Date.now() - startTime;
                        log(\`⚡ Time to first token: \${timeToFirstToken}ms\`);
                    }
                });
                
                const result = await window.electronAPI.invokeLocalChatModel('sendMessage', {
                    message: 'Hello! Please tell me a short interesting fact.',
                    modelPath: currentModelPath,
                    temperature: 0.7,
                    maxTokens: 100,
                    messageId: 'test-' + Date.now()
                });
                
                removeChunkListener();
                
                const totalTime = Date.now() - startTime;
                
                if (result.success) {
                    const tokensPerSec = result.usage ? 
                        (result.usage.totalTokens / (totalTime / 1000)).toFixed(2) : 
                        'N/A';
                    
                    updateProgress(100, 'Inference completed');
                    updateMetric('inferenceTime', \`\${totalTime} ms\`);
                    updateMetric('tokensPerSec', tokensPerSec);
                    
                    log(\`✅ Inference completed in \${totalTime}ms\`);
                    log(\`📊 Tokens/sec: \${tokensPerSec}\`);
                    log(\`📝 Response: \${result.data.substring(0, 100)}...\`);
                } else {
                    updateProgress(0, 'Inference failed');
                    log(\`❌ Inference failed: \${result.error}\`);
                }
            } catch (error) {
                updateProgress(0, 'Inference failed');
                log(\`❌ Inference error: \${error.message}\`);
            }
        });

        document.getElementById('testStress').addEventListener('click', async () => {
            if (!currentModelPath) {
                alert('Please select a model file first');
                return;
            }
            
            log('Starting stress test (5 iterations)...');
            const results = [];
            
            for (let i = 1; i <= 5; i++) {
                updateProgress((i-1) * 20, \`Stress test iteration \${i}/5\`);
                log(\`--- Iteration \${i}/5 ---\`);
                
                try {
                    const startTime = Date.now();
                    const result = await window.electronAPI.invokeLocalChatModel('sendMessage', {
                        message: \`Iteration \${i}: Tell me a short fact about space.\`,
                        modelPath: currentModelPath,
                        temperature: 0.7,
                        maxTokens: 50,
                        messageId: 'stress-' + i + '-' + Date.now()
                    });
                    
                    const totalTime = Date.now() - startTime;
                    results.push({ success: result.success, time: totalTime });
                    
                    if (result.success) {
                        log(\`✅ Iteration \${i}: \${totalTime}ms\`);
                    } else {
                        log(\`❌ Iteration \${i} failed: \${result.error}\`);
                    }
                } catch (error) {
                    results.push({ success: false, time: 0 });
                    log(\`❌ Iteration \${i} error: \${error.message}\`);
                }
                
                if (i < 5) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Calculate averages
            const successful = results.filter(r => r.success);
            const avgTime = successful.length > 0 ? 
                successful.reduce((sum, r) => sum + r.time, 0) / successful.length : 0;
            
            updateProgress(100, 'Stress test completed');
            log(\`📊 Stress test completed: \${successful.length}/5 successful, avg: \${Math.round(avgTime)}ms\`);
        });

        document.getElementById('testUnload').addEventListener('click', async () => {
            log('Unloading model...');
            // Note: We don't have a direct unload method, but we can test memory after operations
            log('ℹ️ Model will be unloaded when app closes or new model loads');
            isModelLoaded = false;
            updateProgress(0, 'Model unloaded');
        });

        document.getElementById('clearLog').addEventListener('click', () => {
            document.getElementById('testLog').textContent = 'Log cleared...\\n';
        });

        // Listen for progress updates
        window.electronAPI.addListener('modelLoadingProgress', (data) => {
            updateProgress(data.progress, data.message);
            log(\`📈 \${data.message} (\${Math.round(data.progress)}%)\`);
        });

        // Monitor memory usage
        setInterval(() => {
            if (window.electronAPI.getMemoryUsage) {
                window.electronAPI.getMemoryUsage().then(usage => {
                    updateMetric('memoryUsage', \`\${Math.round(usage.rss / 1024 / 1024)} MB\`);
                });
            }
        }, 2000);

        log('Test interface loaded. Select a model file to begin.');
    </script>
</body>
</html>`;

    // Write the HTML to a temporary file
    const htmlPath = path.join(__dirname, 'test-local-model.html');
    fs.writeFileSync(htmlPath, htmlContent);
    
    await this.mainWindow.loadFile(htmlPath);
    
    // Clean up the temporary file when window closes
    this.mainWindow.on('closed', () => {
      try {
        fs.unlinkSync(htmlPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  }

  async initialize() {
    // Initialize local model handlers
    try {
      const { initializeLocalModelIpcHandlers } = require('./electron/localModelIpcHandlers');
      await initializeLocalModelIpcHandlers();
      console.log('✅ Local model IPC handlers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize local model handlers:', error);
    }

    // Add memory usage handler
    ipcMain.handle('getMemoryUsage', () => {
      return process.memoryUsage();
    });

    // Add performance monitoring
    ipcMain.on('log-performance', (event, data) => {
      console.log('Performance Log:', data);
    });

    await this.createWindow();
  }
}

// Create test preload script
const preloadContent = `
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Local model methods
  invokeLocalChatModel: (method, args) => 
    ipcRenderer.invoke('invokeLocalChatModel', { method, args }),
  loadLocalModel: (args) => 
    ipcRenderer.invoke('loadLocalModel', args),
  isModelLoaded: (args) => 
    ipcRenderer.invoke('isModelLoaded', args),
  getMemoryUsage: () => 
    ipcRenderer.invoke('getMemoryUsage'),
  
  // Event listeners
  addListener: (channel, callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
});
`;

// Write preload script
fs.writeFileSync(path.join(__dirname, 'test-preload.js'), preloadContent);

// App initialization
app.whenReady().then(async () => {
  const tester = new LocalModelElectronTester();
  await tester.initialize();
});

app.on('window-all-closed', () => {
  // Clean up preload script
  try {
    fs.unlinkSync(path.join(__dirname, 'test-preload.js'));
  } catch (e) {
    // Ignore cleanup errors
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const tester = new LocalModelElectronTester();
    await tester.initialize();
  }
});

console.log('🚀 Starting Local Model Electron Test App...');
console.log('This will test the local model functionality in isolation.'); 