import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import "./index.css"
import { ModelProvider } from "./contexts/ModelContext";

// Performance optimization: Disable console logging in production
if (import.meta.env.PROD) {
  console.log = () => {}
  console.warn = () => {}
  console.info = () => {}
  // Keep console.error for debugging critical issues
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ModelProvider>
      <App />
    </ModelProvider>
  </React.StrictMode>
)
