// Any Mongoose model exposes `exists`; we only need that (avoids the invariant
// Model<T> generic clashing between Event and League).
interface HasExists {
  exists(filter: { slug: string }): Promise<unknown>;
}

// Build a URL-safe slug from a (possibly Hebrew) name plus a short random
// suffix, guaranteed unique against the given collection's `slug` field. Hebrew
// names transliterate to nothing, so we fall back to a stable base.
function baseSlug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "comp";
}

const rand = (): string => Math.random().toString(36).slice(2, 8);

/** Generate a slug unique within `model`'s collection. */
export async function uniqueSlug(
  model: HasExists,
  name: string
): Promise<string> {
  const base = baseSlug(name);
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${rand()}`;
    const exists = await model.exists({ slug: candidate });
    if (!exists) return candidate;
  }
  // Extremely unlikely; fall back to a longer random tail.
  return `${base}-${rand()}${rand()}`;
}
