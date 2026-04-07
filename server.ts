import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for Yahoo Finance
  app.get("/api/mstr-stock", async (req, res) => {
    try {
      const response = await fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/MSTR?range=1mo&interval=1d"
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock data" });
    }
  });

  // Proxy for Bitcoin Price
  app.get("/api/btc-price", async (req, res) => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BTC price" });
    }
  });

  // Proxy for Bitcoin History
  app.get("/api/btc-history", async (req, res) => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily"
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BTC history" });
    }
  });

  // Proxy for BTC Holdings (MicroStrategy)
  app.get("/api/mstr-holdings", async (req, res) => {
    try {
      const response = await fetch("https://www.microstrategy.com/content/experience-fragments/microstrategy/en/investor-relations/bitcoin-holdings/master/_jcr_content/root/container/container/bitcoin_holdings.model.json");
      if (response.ok) {
          const data = await response.json();
          res.json(data);
      } else {
          res.json({
              totalBitcoinHeld: 766970,
              lastUpdated: "2026-04-06T00:00:00Z"
          });
      }
    } catch (error) {
      res.json({
          totalBitcoinHeld: 766970,
          lastUpdated: "2026-04-06T00:00:00Z"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
