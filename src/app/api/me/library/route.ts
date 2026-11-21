import { ok, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/session";
import { getLibrary, type LibraryFilter } from "@/server/lessons";

/** GET /api/me/library?filter=saved|completed&page=1 */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const url = new URL(req.url);
  const filter: LibraryFilter = url.searchParams.get("filter") === "completed" ? "completed" : "saved";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const result = await getLibrary(user.id, filter, page);
  return ok(result.items, { meta: { filter, page: result.page, hasMore: result.hasMore } });
});
