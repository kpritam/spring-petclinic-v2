import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prismThemes } from "prism-react-renderer";
import { spellbookWebpackPlugin } from "./spellbookPlugin";

// macOS EMFILE workaround when `docs.path` walks the whole tome: force
// Webpack/Watchpack and chokidar onto polling. Opt out with
// WATCHPACK_POLLING=false / CHOKIDAR_USEPOLLING=false.
if (!Object.hasOwn(process.env, "WATCHPACK_POLLING")) {
  process.env.WATCHPACK_POLLING = "true";
}
if (!Object.hasOwn(process.env, "CHOKIDAR_USEPOLLING")) {
  process.env.CHOKIDAR_USEPOLLING = "true";
}

const grimoireDevWatchPlugin = () => ({
  name: "grimoire-dev-watch",
  configureWebpack() {
    return {
      watchOptions: {
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.docusaurus/**",
          "**/build/**",
          "**/dist/**",
          "**/.turbo/**",
          "**/.next/**",
          "**/coverage/**",
        ],
      },
    };
  },
});

// Sidebar polish: humanize raw slugs into Sentence-case, upper-case known
// technical acronyms, and weight common top-level slugs (getting-started
// first, architecture / internals last). Agent-authored `sidebar_label` /
// `sidebar_position` always wins over these fallbacks.
const SIDEBAR_ACRONYMS = new Set([
  "cli", "ci", "cd", "ai", "api", "sdk", "url", "uri", "http", "https",
  "json", "yaml", "md", "mdx", "sha", "dsl", "ide", "ui", "ux", "io",
  "pr", "mr", "os", "sql", "tls", "ssh", "cors", "dns", "tcp", "udp", "jwt",
]);
const humanizeSidebarLabel = (slug: string): string =>
  slug
    .split(/[-_\s]+/)
    .map((w, i) => {
      if (!w) return w;
      if (SIDEBAR_ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
      if (/^v\d/.test(w)) return w.toLowerCase();
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(" ");

const SIDEBAR_WEIGHTS: Record<string, number> = {
  "index": -1000,
  "introduction": -900,
  "intro": -900,
  "getting-started": -800,
  "quickstart": -780,
  "quick-start": -780,
  "installation": -760,
  "install": -760,
  "tutorial": -700,
  "overview": -680,
  "concepts": -400,
  "guides": -300,
  "how-to": -280,
  "recipes": -260,
  "reference": 200,
  "api": 220,
  "cli": 220,
  "configuration": 230,
  "config": 230,
  "architecture": 600,
  "internals": 700,
  "development": 780,
  "contributing": 800,
  "roadmap": 880,
  "changelog": 900,
  "faq": 920,
  "troubleshooting": 940,
};
const sidebarWeight = (slug: string): number =>
  SIDEBAR_WEIGHTS[slug.toLowerCase()] ?? 0;

// GitHub Pages serves at `https://<org>.github.io/<repo>/`, so `baseUrl`
// must be `/<repo>/` in production or every relative link (nav, docs,
// citations) 404s. The deploy workflow sets these via `actions/configure-pages`;
// locally we fall back to root-served defaults. Trailing slash on
// `DOCS_BASE_URL` is required.
const config: Config = {
  title: "Spring PetClinic",
  tagline: "A reference application that grows with you",
  favicon: "img/logo.svg",
  url: process.env.DOCS_URL || "https://example.com",
  baseUrl: process.env.DOCS_BASE_URL || "/",
  organizationName: process.env.DOCS_ORG_NAME || "grimoire",
  projectName: process.env.DOCS_PROJECT_NAME || "docs",
  onBrokenLinks: "warn",
  markdown: {
    mermaid: true,
    format: "mdx",
  },
  presets: [
    [
      "classic",
      {
        docs: {
          path: "../",
          exclude: [
            "site/**",
            "**/node_modules/**",
            "**/.git/**",
            ".grimoire/**",
            "**/.grimoire/**",
            ".grimoire-seal",
            "**/.grimoire-seal",
            ".grimoire-progress.json",
            "**/.grimoire-progress.json",
            // README.md and index.md (slug: /) would both claim "/" — keep the
            // landing page and exclude README globally.
            "**/README.md",
          ],
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editLocalizedFiles: false,
          editUrl: undefined,
          sidebarItemsGenerator: async ({
            defaultSidebarItemsGenerator,
            ...args
          }) => {
            const items = await defaultSidebarItemsGenerator(args);
            const hiddenAnywhere = new Set(["README"]);
            const hiddenAtRoot = new Set(["index"]);
            const slugTail = (id: string): string => {
              const segs = id.split("/");
              return segs[segs.length - 1] ?? id;
            };
            const looksRawSlug = (s: string): boolean =>
              /^[a-z0-9]+([-_][a-z0-9]+)*$/.test(s);
            type Item = (typeof items)[number];
            const itemKey = (item: Item): string => {
              if (item.type === "doc") return slugTail(item.id).toLowerCase();
              if (item.type === "category") return item.label.toLowerCase();
              return "";
            };
            const sortTopLevel = (list: Item[]): Item[] =>
              [...list].sort((a, b) => {
                const ka = itemKey(a);
                const kb = itemKey(b);
                const wa = sidebarWeight(ka);
                const wb = sidebarWeight(kb);
                if (wa !== wb) return wa - wb;
                return ka.localeCompare(kb);
              });
            const walk = (item: Item, depth: number): Item | null => {
              if (item.type === "doc") {
                const tail = slugTail(item.id);
                if (hiddenAnywhere.has(tail)) return null;
                if (depth === 0 && hiddenAtRoot.has(tail)) return null;
                if (!item.label && looksRawSlug(tail)) {
                  return { ...item, label: humanizeSidebarLabel(tail) };
                }
                return item;
              }
              if (item.type === "category") {
                const label = looksRawSlug(item.label)
                  ? humanizeSidebarLabel(item.label)
                  : item.label;
                const children = item.items
                  .map((c: Item) => walk(c, depth + 1))
                  .filter((x: Item | null): x is Item => x !== null);
                return {
                  ...item,
                  label,
                  collapsed: depth === 0 ? false : item.collapsed,
                  items: children,
                };
              }
              return item;
            };
            return sortTopLevel(
              items
                .map((c: Item) => walk(c, 0))
                .filter((x: Item | null): x is Item => x !== null),
            );
          },
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [grimoireDevWatchPlugin, spellbookWebpackPlugin],
  themes: ["@docusaurus/theme-mermaid"],
  themeConfig: {
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Spring PetClinic",
      logo: {
        alt: "Spring PetClinic",
        src: "img/logo.svg",
        srcDark: "img/logo-dark.svg",
      },
      items: [
      ],
    },
    footer: {
      style: "dark",
      copyright: `© ${new Date().getFullYear()} ${"Spring PetClinic"}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    mermaid: { theme: { light: "neutral", dark: "dark" } },
  },
};

export default config;
