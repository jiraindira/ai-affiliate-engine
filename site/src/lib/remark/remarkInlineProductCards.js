import { visit } from "unist-util-visit";

/**
 * remarkInlineProductCards
 *
 * Layout:
 * - H3 stays as-is (product title)
 * - Insert a rating line under H3:
 *     - If rating + reviews are present: "★★★★☆ 4.6 (12,418 reviews)"
 *     - If missing/zero (pre-Amazon): "Rating pending"
 * - Wrap the FIRST paragraph after the H3 into a pick layout:
 *     [tile] [paragraph...]
 *     [Check price →]
 *
 * Server-side only. No client JS.
 *
 * Frontmatter products list (any of):
 * - vfile.data.astro.frontmatter.products
 * - vfile.data.astro.frontmatter.picks
 * - vfile.data.astro.frontmatter.items
 *
 * Product fields supported:
 * - title (string)
 * - url (string)
 * - amazon_search_query (string)
 * - rating (number|string)
 * - review_count (number|string)
 * - reviews_count (number|string)  // supported alias
 */
export function remarkInlineProductCards() {
  console.log("[remarkInlineProductCards] LOADED");
  return (tree, vfile) => {
    const products = getProductsFromVFile(vfile);
    if (!products.length) return;

    const productByTitle = new Map(
      products
        .filter((p) => p && typeof p.title === "string" && p.title.trim().length > 0)
        .map((p) => [normalizeTitle(p.title), p])
    );

    const rootChildren = tree.children;
    if (!Array.isArray(rootChildren) || rootChildren.length === 0) return;

    for (let i = 0; i < rootChildren.length; i++) {
      const node = rootChildren[i];
      if (!isH3(node)) continue;

      const headingText = extractHeadingText(node);
      if (!headingText) continue;

      const product = productByTitle.get(normalizeTitle(headingText));
      if (!product) continue;

      const ratingLineNode = buildRatingLineNode(product);

      const nextNode = rootChildren[i + 1];
      const hasParagraph = nextNode && nextNode.type === "paragraph";

      const { ctaHref, ctaLabel, siteHost } = buildCta(product, headingText);
      const initials = buildInitials(headingText);

      const pickOpen = {
        type: "html",
        value: buildPickOpenHtml({ initials, siteHost }),
      };

      const ctaHtml = {
        type: "html",
        value: buildCtaHtml({ ctaHref, ctaLabel }),
      };

      const pickClose = {
        type: "html",
        value: `</div>`,
      };

      if (hasParagraph) {
        const paragraphNode = nextNode;

        // Replace: [H3][paragraph]
        // With:    [H3][rating][open][paragraph][cta][close]
        rootChildren.splice(i + 1, 1, ratingLineNode, pickOpen, paragraphNode, ctaHtml, pickClose);
        i += 5;
      } else {
        // No paragraph found. Still inject rating + minimal pick block.
        rootChildren.splice(i + 1, 0, ratingLineNode, pickOpen, ctaHtml, pickClose);
        i += 3;
      }
    }
  };
}

/* -----------------------------
   Helpers
----------------------------- */

function getProductsFromVFile(vfile) {
  const fm = vfile?.data?.astro?.frontmatter;
  if (!fm || typeof fm !== "object") return [];

  const candidates = [fm.products, fm.picks, fm.items].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function isH3(node) {
  return node && node.type === "heading" && node.depth === 3;
}

function extractHeadingText(heading) {
  let out = "";
  for (const child of heading.children || []) {
    if (child.type === "text" && typeof child.value === "string") out += child.value;
    if (child.type === "inlineCode" && typeof child.value === "string") out += child.value;
  }
  return out.trim();
}

function normalizeTitle(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”"']/g, "")
    .replace(/[^\w\s-]/g, "");
}

function buildRatingLineNode(product) {
  const ratingRaw = product?.rating;
  const reviewsRaw =
    product?.review_count !== undefined ? product.review_count : product?.reviews_count;

  const rating = toNumber(ratingRaw);
  const reviews = toNumber(reviewsRaw);

  const hasRating = Number.isFinite(rating) && rating > 0;
  const hasReviews = Number.isFinite(reviews) && reviews > 0;

  // Pre-enrichment state: keep it intentional and quiet.
  if (!hasRating || !hasReviews) {
    return {
      type: "html",
      value: `<div class="pick-rating pick-rating--pending">Rating pending</div>`,
    };
  }

  const stars = toStarString(rating);
  const ratingText = formatRating(rating);
  const reviewText = `(${formatReviews(reviews)} reviews)`;

  const line = `${stars} ${ratingText} ${reviewText}`.trim();
  return {
    type: "html",
    value: `<div class="pick-rating" aria-label="Rating">${escapeHtml(line)}</div>`,
  };
}

function toStarString(rating) {
  // 4.6 -> ★★★★☆
  const full = Math.max(0, Math.min(5, Math.floor(rating)));
  const empty = 5 - full;
  return `${"★".repeat(full)}${"☆".repeat(empty)}`;
}

function formatRating(rating) {
  const rounded = Math.round(rating * 10) / 10;
  return String(rounded);
}

function formatReviews(n) {
  // n is a number here
  return n.toLocaleString("en-GB");
}

function toNumber(x) {
  if (typeof x === "number") return x;
  if (typeof x !== "string") return Number.NaN;

  const cleaned = x.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

function buildCta(product, fallbackTitle) {
  const url = typeof product.url === "string" ? product.url.trim() : "";
  const hasUrl = url.length > 0;

  const query =
    typeof product.amazon_search_query === "string" && product.amazon_search_query.trim().length > 0
      ? product.amazon_search_query.trim()
      : String(product.title || fallbackTitle || "").trim();

  const amazonSearchUrl = query ? `https://www.amazon.co.uk/s?k=${encodeURIComponent(query)}` : "";

  const ctaHref = hasUrl ? url : amazonSearchUrl;
  const ctaLabel = hasUrl ? "Check price →" : "Search on Amazon →";

  const siteHost = hasUrl ? hostname(url) : "amazon.co.uk";

  return { ctaHref, ctaLabel, siteHost };
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function buildInitials(title) {
  const t = String(title || "").trim();
  if (!t) return "•";

  const words = t
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return (words[0][0] + words[1][0]).toUpperCase();
}

function buildPickOpenHtml({ initials }) {
  const safeInitials = escapeHtml(initials);

  return `
<div class="pick">
  <div class="pick-row">
    <div class="pick-tile" aria-hidden="true">${safeInitials}</div>
    <div class="pick-body">
`.trim();
}


function buildCtaHtml({ ctaHref, ctaLabel }) {
  if (!ctaHref) {
    return `
      <div class="pick-cta-row"></div>
    </div>
  </div>
</div>
`.trim();
  }

  const safeHref = escapeAttr(ctaHref);
  const safeLabel = escapeHtml(ctaLabel);

  return `
      <div class="pick-cta-row">
        <a class="pick-cta" href="${safeHref}" rel="sponsored nofollow noopener" target="_blank">${safeLabel}</a>
      </div>
    </div>
  </div>
</div>
`.trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
