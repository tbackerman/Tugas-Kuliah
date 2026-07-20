import type { Request, Response } from "express";

let app: any;

try {
  const serverModule = await import("../server");
  app = serverModule.default;
} catch (err: any) {
  console.error("CRITICAL TOP-LEVEL ERROR IN SERVER INIT:", err);
  
  // Dynamic import express as a fallback
  const express = (await import("express")).default;
  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.all("*", (req: Request, res: Response) => {
    res.status(500).json({
      error: "Critical Server Init Error",
      message: err?.message || String(err),
      stack: err?.stack || "No stack trace available"
    });
  });
}

export default app;
