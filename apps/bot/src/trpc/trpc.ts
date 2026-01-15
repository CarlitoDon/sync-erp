import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import * as trpcExpress from "@trpc/server/adapters/express";
import dotenv from "dotenv";

dotenv.config();

// Create context based on Express request/response
export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({
  req,
  res,
});

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const isAuthed = t.middleware(({ ctx, next }) => {
  const authHeader = ctx.req.headers.authorization;
  const apiSecret = process.env.API_SECRET;

  if (!authHeader) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing Authorization header",
    });
  }
  const token = authHeader.split(" ")[1];
  if (token !== apiSecret) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid API Key" });
  }
  return next();
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
