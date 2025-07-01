import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import "./index.css"
import { ModelProvider } from "./contexts/ModelContext";

// Performance optimization: Disable console logging in production
if (import.meta.env.PROD) {
  // More aggressive console disabling for production performance
  const noop = () => {}
  console.log = noop
  console.warn = noop
  console.info = noop
  console.debug = noop
  console.trace = noop
  console.time = noop
  console.timeEnd = noop
  console.group = noop
  console.groupEnd = noop
  console.groupCollapsed = noop
  console.count = noop
  console.countReset = noop
  console.clear = noop
  // Keep console.error for debugging critical issues
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ModelProvider>
      <App />
    </ModelProvider>
  </React.StrictMode>
)
