import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import slugify from "slugify";
import dayjs from "dayjs";
import yaml from "js-yaml";

import { configDotenv } from "dotenv";

configDotenv();

// ──────────────────────────────────────────────────────────────
// 환경 변수
// ──────────────────────────────────────────────────────────────
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DATABASE_ID; // ⚠️ 여기에는 이미 data_source_id 가 들어있음
const TZ = process.env.TIMEZONE || "Asia/Seoul";
const POSTS_DIR = process.env.POSTS_DIR || "_posts";
const ASSET_DIR = process.env.ASSET_DIR || "assets/img/for_post";
const DOWNLOAD_COVER =
  (process.env.DOWNLOAD_COVER || "true").toLowerCase() === "true";

const TITLE_KEYS = (process.env.TITLE_KEYS || "제목,Title,Name")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DATE_PROP = process.env.DATE_PROP || "생성일";
const DEPLOY_PROP = process.env.DEPLOY_PROP || "배포";
const TAG_PROP = process.env.TAG_PROP || "태그";
const CATEGORY_PRIMARY_PROP = process.env.CATEGORY_PRIMARY_PROP || "카테고리";
const CATEGORY_SECONDARY_PROP = process.env.CATEGORY_SECONDARY_PROP || "분류";

process.env.TZ = TZ;

// ──────────────────────────────────────────────────────────────
// Notion 클라이언트 + 헬퍼
// ──────────────────────────────────────────────────────────────
const notion = new Client({ auth: NOTION_TOKEN, notionVersion: "2025-09-03" });

// 🔥 여기 수정됨
async function queryDatabase(dataSourceId, body = {}) {
  return notion.request({
    path: `data_sources/${dataSourceId}/query`, // ✅ data_sources 사용
    method: "POST",
    body,
  });
}

async function getPage(pageId) {
  return notion.request({
    path: `pages/${pageId}`,
    method: "GET",
  });
}

async function updatePage(pageId, body) {
  return notion.request({
    path: `pages/${pageId}`,
    method: "PATCH",
    body,
  });
}

// ──────────────────────────────────────────────────────────────
// Markdown 변환
// ──────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const n2m = new NotionToMarkdown({ notionClient: notion });

const plain = (richArr = []) =>
  richArr
    .map((t) => t.plain_text)
    .join("")
    .trim();

function getTitle(props) {
  for (const k of TITLE_KEYS) {
    if (props[k]?.title?.length) return plain(props[k].title);
  }
  if (props.Name?.title?.length) return plain(props.Name.title);
  if (props.Title?.title?.length) return plain(props.Title.title);
  return "Untitled";
}

function toSlugFromTitle(title) {
  return slugify(title || "post", { lower: true, strict: true, trim: true });
}

function ymd(dateStr) {
  return dayjs(dateStr).format("YYYY-MM-DD");
}
function y(dateStr) {
  return dayjs(dateStr).format("YYYY");
}
function toJekyllDateTime(dateStr) {
  return dayjs(dateStr).format("YYYY-MM-DD HH:mm:ss ZZ");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function sanitizeFileName(name) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function extFromContentType(ct) {
  if (!ct) return null;
  const mime = ct.split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("image/")) return null;
  let ext = mime.split("/")[1];
  if (ext === "jpeg") ext = "jpg";
  return ext;
}
function extFromUrl(u) {
  try {
    const pathname = new URL(u).pathname;
    const base = pathname.split("/").pop() || "";
    const dot = base.lastIndexOf(".");
    if (dot > -1 && dot < base.length - 1) {
      const ext = base.slice(dot + 1).toLowerCase();
      if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
    }
  } catch {}
  return null;
}
async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 NotionSync" },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`);
  const ab = await res.arrayBuffer();
  const ct = res.headers.get("content-type") || "";
  return { buf: Buffer.from(ab), contentType: ct };
}
async function saveImageFromUrl(url, destDir, baseNameHint) {
  ensureDir(destDir);
  let ext = extFromUrl(url);
  let buf, ct;
  try {
    const r = await fetchBuffer(encodeURI(url));
    buf = r.buf;
    ct = r.contentType;
  } catch (e) {
    console.warn(`⚠️  Image download failed: ${url} (${e.message})`);
    return null;
  }
  if (!ext) ext = extFromContentType(ct) || "png";
  const base = sanitizeFileName(baseNameHint || "img");
  let name = `${base}.${ext}`,
    i = 1;
  while (fs.existsSync(path.join(destDir, name))) {
    name = `${base}-${String(i++).padStart(2, "0")}.${ext}`;
  }
  fs.writeFileSync(path.join(destDir, name), buf);
  return name;
}

function readFrontMatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm = yaml.load(m[1] || "") || {};
  const body = m[2] || "";
  return { fm, body };
}

function findExistingPostFileByNotionIdOrSlug(pageId, slug) {
  if (!fs.existsSync(POSTS_DIR)) return null;
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".md"));

  for (const f of files) {
    const full = path.join(POSTS_DIR, f);
    try {
      const { fm } = readFrontMatter(full);
      if (fm?.notion_id === pageId) return full;
    } catch {}
  }

  const suffix = `-${slug}.md`;
  const hit = files.find((f) => f.endsWith(suffix));
  return hit ? path.join(POSTS_DIR, hit) : null;
}

async function pageToMarkdown(pageId) {
  const mdBlocks = await n2m.pageToMarkdown(pageId);
  const md = n2m.toMarkdownString(mdBlocks);
  return typeof md === "string" ? md : md.parent;
}

function getSelectOrMultiNames(props, propName) {
  const p = props?.[propName];
  if (!p) return [];
  if (p.multi_select?.length) return p.multi_select.map((t) => t.name);
  const s = p.select?.name;
  return s ? [s] : [];
}
function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

// ──────────────────────────────────────────────────────────────
// DB 조회 (배포 체크박스 on만)
// ──────────────────────────────────────────────────────────────
async function queryDeployQueue() {
  const pages = [];
  let cursor = undefined;
  while (true) {
    const res = await queryDatabase(DB_ID, {
      start_cursor: cursor,
      page_size: 50,
      filter: { property: DEPLOY_PROP, checkbox: { equals: true } },
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    });
    pages.push(...res.results);
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return pages;
}

// ──────────────────────────────────────────────────────────────
// 실행
// ──────────────────────────────────────────────────────────────
async function run() {
  if (!NOTION_TOKEN || !DB_ID) {
    console.error("❌ NOTION_TOKEN or NOTION_DATABASE_ID is missing.");
    process.exit(1);
  }
  ensureDir(POSTS_DIR);

  const deployPages = await queryDeployQueue();
  let changed = 0;

  for (const p of deployPages) {
    const pageId = p.id;
    const page = await getPage(pageId);
    const props = page.properties || {};

    const title = getTitle(props);
    const slug = toSlugFromTitle(title);
    const dateRaw = props[DATE_PROP]?.date?.start || p.created_time;
    const dateForFrontMatter = toJekyllDateTime(dateRaw);
    const dateForFile = ymd(dateRaw);
    const year = y(dateRaw);

    const catsPrimary = getSelectOrMultiNames(props, CATEGORY_PRIMARY_PROP);
    const catsSecondary = getSelectOrMultiNames(props, CATEGORY_SECONDARY_PROP);
    const categoriesArr = uniq([catsPrimary[0], catsSecondary[0]]).slice(0, 2);

    const tagsArr = uniq([
      ...getSelectOrMultiNames(props, TAG_PROP),
      ...getSelectOrMultiNames(props, "Tags"),
      ...getSelectOrMultiNames(props, "Tag"),
    ]);

    let contentMd = await pageToMarkdown(pageId);

    const existingFile = findExistingPostFileByNotionIdOrSlug(pageId, slug);
    let existingFm = {};
    if (existingFile) {
      try {
        existingFm = readFrontMatter(existingFile).fm || {};
      } catch {}
    }

    const imgPathFront =
      existingFm.img_path || `/${ASSET_DIR}/${year}/${slug}/`;
    const postAssetDir = path.join(ASSET_DIR, year, slug);
    ensureDir(postAssetDir);

    let coverFileName = null;
    let coverAlt = "";
    if (DOWNLOAD_COVER && page.cover) {
      const coverUrl = page.cover?.file?.url || page.cover?.external?.url;
      if (coverUrl) {
        const name = await saveImageFromUrl(coverUrl, postAssetDir, "cover");
        if (name) coverFileName = name;
      }
    }

    const urlPattern = /!\[([^\]]*)\]\((\s*<?([^)\s]+)>?)(?:\s+"[^"]*")?\)/g;
    let match;
    let imgIndex = 1;
    const replacements = new Map();

    while ((match = urlPattern.exec(contentMd)) !== null) {
      const alt = match[1];
      const url = match[3];
      if (!/^https?:\/\//i.test(url)) continue;
      if (replacements.has(url)) continue;

      const base = `${dayjs(dateRaw).format("YYYYMMDD")}-${slug}-${String(
        imgIndex++
      ).padStart(2, "0")}`;
      const localName = await saveImageFromUrl(url, postAssetDir, base);
      if (localName) {
        replacements.set(url, localName);
        if (!coverFileName) {
          coverFileName = localName;
          coverAlt = coverAlt || alt || "";
        }
      }
    }
    for (const [from, localName] of replacements.entries()) {
      contentMd = contentMd.split(from).join(`{{ page.img_path }}${localName}`);
    }

    const fmObj = {
      title,
      date: existingFm.date || dateForFrontMatter,
      img_path: imgPathFront,
      image: coverFileName ? { path: coverFileName, alt: coverAlt } : undefined,
      categories: categoriesArr.length ? categoriesArr : undefined,
      tags: tagsArr.length ? tagsArr : undefined,
      notion_id: pageId,
      notion_last_edited: page.last_edited_time,
    };
    Object.keys(fmObj).forEach((k) => {
      const v = fmObj[k];
      if (
        v === undefined ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === "string" && v.trim() === "")
      ) {
        delete fmObj[k];
      }
    });

    const fmYaml = yaml.dump(fmObj, { lineWidth: 100 });
    const finalMd = `---\n${fmYaml}---\n\n${contentMd}\n`;

    const targetPath =
      existingFile || path.join(POSTS_DIR, `${dateForFile}-${slug}.md`);

    let needWrite = true;
    if (fs.existsSync(targetPath)) {
      const prev = fs.readFileSync(targetPath, "utf8");
      if (prev === finalMd) needWrite = false;
    }
    if (needWrite) {
      fs.writeFileSync(targetPath, finalMd, "utf8");
      console.log(`✅ Updated: ${targetPath}`);
      changed++;
    } else {
      console.log(`↔  No change: ${targetPath}`);
    }

    try {
      await updatePage(pageId, {
        properties: { [DEPLOY_PROP]: { checkbox: false } },
      });
      console.log(`🔓 Unchecked '${DEPLOY_PROP}' for page ${pageId}`);
    } catch (e) {
      console.warn(
        `⚠️ Failed to uncheck '${DEPLOY_PROP}' for ${pageId}: ${e.message}`
      );
    }
  }

  console.log(`\nDone. ${changed} file(s) updated.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
