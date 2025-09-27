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
const DB_ID = process.env.NOTION_DATABASE_ID; // data_source_id 가 들어있음
const TZ = process.env.TIMEZONE || "Asia/Seoul";
const POSTS_DIR = process.env.POSTS_DIR || "_posts";
const ASSET_DIR = process.env.ASSET_DIR || "assets/img/for_post";
const DOWNLOAD_COVER =
  (process.env.DOWNLOAD_COVER || "true").toLowerCase() === "true";

const TITLE_KEYS = (process.env.TITLE_KEYS || "제목,이름,Title,Name,title,name")
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
const notion = new Client({ auth: NOTION_TOKEN, notionVersion: "2025-09-03" });

async function queryDatabase(dataSourceId, body = {}) {
  return notion.request({
    path: `data_sources/${dataSourceId}/query`,
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
  if (props.title?.title?.length) return plain(props.title.title);
  if (props.name?.title?.length) return plain(props.name.title);
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

// ✅ 노션 ID 의존 제거: slug 기준으로만 기존 파일 탐색
function findExistingPostFileBySlug(slug) {
  if (!fs.existsSync(POSTS_DIR)) return null;
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".md"));

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

  // 웹 경로용(슬래시 고정) ASSET DIR
  const ASSET_DIR_WEB = ASSET_DIR.split(path.sep).join("/");

  for (const p of deployPages) {
    const pageId = p.id;
    const page = await getPage(pageId);
    const props = page.properties || {};

    const title = getTitle(props);
    const slug = toSlugFromTitle(title);

    const dateRaw = props[DATE_PROP]?.date?.start || p.created_time;
    const dateForFrontMatter = toJekyllDateTime(dateRaw);
    const lastModForFrontMatter = toJekyllDateTime(page.last_edited_time);
    const dateForFile = ymd(dateRaw);

    const catsPrimary = getSelectOrMultiNames(props, CATEGORY_PRIMARY_PROP);
    const catsSecondary = getSelectOrMultiNames(props, CATEGORY_SECONDARY_PROP);
    const categoriesArr = uniq([catsPrimary[0], catsSecondary[0]]).slice(0, 2);

    const tagsArr = uniq([
      ...getSelectOrMultiNames(props, TAG_PROP),
      ...getSelectOrMultiNames(props, "Tags"),
      ...getSelectOrMultiNames(props, "Tag"),
    ]);

    // 본문 MD
    let contentMd = await pageToMarkdown(pageId);

    // 기존 파일(슬러그 기준) 탐색
    const existingFile = findExistingPostFileBySlug(slug);

    // 이미지 저장 경로: assets/img/for_post/{slug}/
    const postAssetDirFs = path.join(ASSET_DIR, slug);
    ensureDir(postAssetDirFs);
    const imgBaseWeb = `/${ASSET_DIR_WEB}/${slug}/`;

    // 표지 다운로드 (사용 시 파일만 저장, FM에는 기록 안 함)
    if (DOWNLOAD_COVER && page.cover) {
      const coverUrl = page.cover?.file?.url || page.cover?.external?.url;
      if (coverUrl) {
        await saveImageFromUrl(coverUrl, postAssetDirFs, "cover");
      }
    }

    // 본문 내 원격 이미지 로컬화 + 경로 치환
    const urlPattern = /!\[([^\]]*)\]\((\s*<?([^)\s]+)>?)(?:\s+"[^"]*")?\)/g;
    let match;
    let imgIndex = 1;
    const replacements = new Map();

    while ((match = urlPattern.exec(contentMd)) !== null) {
      const url = match[3];
      if (!/^https?:\/\//i.test(url)) continue;
      if (replacements.has(url)) continue;

      const base = `${dayjs(dateRaw).format("YYYYMMDD")}-${slug}-${String(
        imgIndex++
      ).padStart(2, "0")}`;
      const localName = await saveImageFromUrl(url, postAssetDirFs, base);
      if (localName) {
        replacements.set(url, localName);
      }
    }
    for (const [from, localName] of replacements.entries()) {
      contentMd = contentMd.split(from).join(`${imgBaseWeb}${localName}`);
    }

    // ✅ Front Matter: 최소 Jekyll 포맷만 유지
    const fmObj = {
      title,
      date: dateForFrontMatter,
      lastmod: lastModForFrontMatter,
      categories: categoriesArr.length ? categoriesArr : undefined,
      tags: tagsArr.length ? tagsArr : undefined,
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

    // 배열 한 줄(flow style)로 출력
    const fmYaml = yaml.dump(fmObj, { lineWidth: 100, flowLevel: 1 });
    const finalMd = `---\n${fmYaml}---\n\n${contentMd}\n`;

    // 파일 경로: _posts/YYYY-MM-DD-{slug}.md (slug 형식 유지)
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

    // 처리 후 배포 체크 해제
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
