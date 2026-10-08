import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { searchQuerySchema } from "../schemas";
import type { SearchProvider } from "../services/search/types";

export function createSearchRouter(provider: SearchProvider): Router {
  const router = Router();

  // GET /api/search?q=lofi&limit=10
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const { q, limit } = searchQuerySchema.parse(req.query);
      const results = await provider.search(q, limit);
      res.json({ query: q, provider: provider.name, results });
    }),
  );

  return router;
}
