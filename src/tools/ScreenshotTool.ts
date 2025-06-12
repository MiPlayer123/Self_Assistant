import { Tool } from "../types/tools";

export class ScreenshotTool implements Tool {
  name = "take_screenshot";
  description = "Captures a screenshot of the entire screen and returns its path and a base64 preview. Useful when the user asks to see something on the screen or to get context about the current screen.";
  input_schema = {
    type: "object",
    properties: {},
    required: [],
  };

  public async execute(): Promise<{ path: string; preview: string }> {
    if (!(window as any).electronAPI || !(window as any).electronAPI.takeScreenshotForTool) {
      console.error("Screenshot API (takeScreenshotForTool) is not available.");
      throw new Error("Screenshot API (takeScreenshotForTool) is not available in this environment.");
    }
    const result = await (window as any).electronAPI.takeScreenshotForTool();
    if (result.error) {
      console.error("Error taking screenshot:", result.error);
      throw new Error(result.error);
    }
    return { path: result.path, preview: result.preview };
  }
}
