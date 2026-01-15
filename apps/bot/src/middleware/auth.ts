import type { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

dotenv.config();

const API_SECRET = process.env.API_SECRET;

export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  if (token !== API_SECRET) {
    return res.status(403).json({ error: "Invalid API Key" });
  }

  next();
};
