import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse large JSON bodies (for images)
  app.use(express.json({ limit: '50mb' }));

  // API Key setup
  const API_KEY = process.env.GEMINI_API_KEY;
  // @ts-ignore
  const genAI = API_KEY ? new GoogleGenAI(API_KEY) : null;

  // Gemini Proxy Endpoint
  app.post("/api/proxy-gemini", async (req, res) => {
    try {
      if (!genAI) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const { model, contents, config } = req.body;
      // @ts-ignore
      const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-3.1-flash-image-preview' });
      
      const result = await geminiModel.generateContent({
        contents,
        generationConfig: config
      });

      const response = await result.response;
      // We return the raw content to the client to parse
      res.json(response);
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", hasKey: !!API_KEY });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
