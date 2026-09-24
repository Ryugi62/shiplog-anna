// UI adapter: user-facing words in English, Simplified Chinese and Korean. Plain, specific, sentence case.

const plural = (n, one, many) => (n === 1 ? one : many);

const EN = {
  question: "What did you ship this week?",
  lead: "Paste commit lines or a few bullet notes. ShipLog writes an X post, a LinkedIn post and a changelog, and checks every number against what you pasted.",
  notesLabel: "Your notes",
  lines: (n) => `${n} ${plural(n, "line", "lines")}`,
  sample: "Try a sample week",
  importToggle: "Import from GitHub",
  repoLabel: "Public GitHub repository",
  importBtn: "Import last 7 days",
  importing: "Importing…",
  privateBefore: "Private repo? Run ",
  privateAfter: " and paste the output. ",
  copyCommand: "Copy command",
  projectLabel: "Project name",
  optional: "optional",
  projectPlaceholder: "e.g. Invoicer",
  toneLabel: "Tone",
  tones: { "build-in-public": "Build in public", professional: "Professional", technical: "Technical" },
  langLabel: "Write in",
  pastWeeks: "Past weeks",
  delete: "Delete",
  historyRow: (n, project) => `${project ? `${project}: ` : ""}${n} ${plural(n, "change", "changes")}`,
  loadingTitle: "Writing your drafts",
  steps: {
    read: (d) => `Read ${d.changeCount} ${plural(d.changeCount, "line", "lines")}, ${d.noiseCount} skipped as noise`,
    draft: () => "Drafting with Anna AI",
    check: () => "Checking every number against your log",
    save: () => "Saving to your log",
  },
  headlineRest: (n) => ` ${plural(n, "change", "changes")} turned into 3 drafts`,
  skipped: (n) => `Skipped ${n} noise ${plural(n, "line", "lines")}.`,
  verdictOk: "Every number matches your log.",
  verdictUnknown: (n) => `${n} ${plural(n, "number isn't", "numbers aren't")} in your log. They're marked in amber. Check them before posting.`,
  verdictOther: "One draft needs a look before posting. See the note under it.",
  drafts: { xPost: "X post", linkedinPost: "LinkedIn post", changelog: "Changelog" },
  copy: "Copy",
  copied: "Copied",
  copySelected: "Selected. Press Ctrl+C",
  markKnown: "Found in your log",
  markUnknown: "Not in your log",
  digestTitle: "What ShipLog read",
  cta: "Write my 3 drafts",
  rewrite: "Rewrite",
  edit: "Edit notes",
  streak: (n) => `${n}-week streak`,
  preview: "Preview mode. Open ShipLog from your Anna dashboard to write drafts.",
  kinds: {
    feat: ["feature", "features"], fix: ["fix", "fixes"], perf: ["speed-up", "speed-ups"], release: ["release", "releases"],
    refactor: ["refactor", "refactors"], docs: ["docs update", "docs updates"], test: ["test update", "test updates"], other: ["other note", "other notes"],
  },
  countSep: ", ",
  countItem: (n, words) => `${n} ${words[n === 1 ? 0 : 1]}`,
  issues: {
    UNSUPPORTED_NUMBER: (v) => `"${v}" isn't in your log. Check it before posting.`,
    LINKEDIN_TOO_LONG: (v) => `This post is ${v} characters. LinkedIn allows 3,000.`,
    X_TOO_LONG: (v) => `This post is ${v} characters. X allows 280.`,
    TOO_SHORT: () => "This draft came out short. Rewrite to get a fuller version.",
    EMPTY: () => "This draft came out empty. Rewrite to try again.",
    DEFAULT: () => "Check this draft before posting.",
  },
  errors: {
    EMPTY_NOTES: "Nothing to write about yet. Paste at least one change. Merges, dependency bumps and typo fixes don't count.",
    QUOTA: "Your Anna AI quota is used up for now. Add credits or use your own key in Anna settings, then try again.",
    NOT_ALLOWED: "ShipLog isn't allowed to use Anna AI. Check the app's permissions in Anna, then try again.",
    TIMEOUT: "The model took too long to answer. Try again. Shorter notes are faster.",
    PROVIDER: "The AI model returned an error. Try again in a minute, or pick another model in Anna settings.",
    UNAVAILABLE: "Anna AI isn't available in this window. Open ShipLog from your Anna dashboard.",
    BAD_MODEL_OUTPUT: "The model's answer couldn't be read. Try again, or pick another model in Anna settings.",
    INVALID_REPO: "Use owner/repo or a github.com link, for example vercel/next.js.",
    NOT_FOUND: "That repository wasn't found. It has to be public. Check the owner and name.",
    RATE_LIMITED: "GitHub's hourly limit for your network is used up. Paste the output of git log instead, or try again later.",
    NO_RECENT_COMMITS: "No commits in the last 7 days on the default branch.",
    NETWORK: "GitHub couldn't be reached. Paste your commits instead.",
    UNKNOWN: "Something went wrong. Try again.",
  },
};

const ZH = {
  question: "这周你发布了什么？",
  lead: "粘贴提交记录或几条要点。ShipLog 会写出一条 X 帖子、一篇 LinkedIn 动态和一段更新日志，并核对其中每个数字是否出自你粘贴的内容。",
  notesLabel: "你的记录",
  lines: (n) => `${n} 行`,
  sample: "用示例周试试",
  importToggle: "从 GitHub 导入",
  repoLabel: "公开的 GitHub 仓库",
  importBtn: "导入最近 7 天",
  importing: "正在导入…",
  privateBefore: "私有仓库？运行 ",
  privateAfter: "，然后粘贴输出。",
  copyCommand: "复制命令",
  projectLabel: "项目名称",
  optional: "可选",
  projectPlaceholder: "例如 Invoicer",
  toneLabel: "语气",
  tones: { "build-in-public": "公开构建", professional: "专业", technical: "技术向" },
  langLabel: "输出语言",
  pastWeeks: "往期",
  delete: "删除",
  historyRow: (n, project) => `${project ? `${project}：` : ""}${n} 项改动`,
  loadingTitle: "正在撰写草稿",
  steps: {
    read: (d) => `已读取 ${d.changeCount} 行，跳过 ${d.noiseCount} 行噪音`,
    draft: () => "Anna AI 正在撰写",
    check: () => "正在逐一核对数字",
    save: () => "正在保存到你的记录",
  },
  headlineRest: () => "改动已整理成 3 篇草稿",
  skipped: (n) => `已跳过 ${n} 行噪音。`,
  verdictOk: "所有数字都能在你的记录中找到。",
  verdictUnknown: (n) => `有 ${n} 个数字不在你的记录中，已用琥珀色标出。发布前请核对。`,
  verdictOther: "有一篇草稿需要在发布前检查，见下方说明。",
  drafts: { xPost: "X 帖子", linkedinPost: "LinkedIn 动态", changelog: "更新日志" },
  copy: "复制",
  copied: "已复制",
  copySelected: "已选中，按 Ctrl+C 复制",
  markKnown: "出自你的记录",
  markUnknown: "不在你的记录中",
  digestTitle: "ShipLog 读取的内容",
  cta: "写出 3 篇草稿",
  rewrite: "重写",
  edit: "修改记录",
  streak: (n) => `连续 ${n} 周`,
  preview: "预览模式。请从 Anna 仪表盘打开 ShipLog 来撰写草稿。",
  kinds: {
    feat: ["个新功能"], fix: ["个修复"], perf: ["项提速"], release: ["次发布"],
    refactor: ["项重构"], docs: ["项文档更新"], test: ["项测试更新"], other: ["条其他记录"],
  },
  countSep: "、",
  countItem: (n, words) => `${n} ${words[0]}`,
  issues: {
    UNSUPPORTED_NUMBER: (v) => `“${v}”不在你的记录中，发布前请核对。`,
    LINKEDIN_TOO_LONG: (v) => `这篇有 ${v} 个字符，LinkedIn 上限为 3,000。`,
    X_TOO_LONG: (v) => `这篇有 ${v} 个字符，X 上限为 280。`,
    TOO_SHORT: () => "这篇草稿太短，点“重写”再生成一次。",
    EMPTY: () => "这篇草稿为空，点“重写”再试一次。",
    DEFAULT: () => "发布前请检查这篇草稿。",
  },
  errors: {
    EMPTY_NOTES: "还没有可写的内容。请至少粘贴一条改动。合并、依赖升级和错别字修正不算。",
    QUOTA: "你的 Anna AI 额度暂时用完了。请在 Anna 设置中充值或使用自己的密钥，然后重试。",
    NOT_ALLOWED: "ShipLog 没有使用 Anna AI 的权限。请在 Anna 中检查应用权限后重试。",
    TIMEOUT: "模型响应超时。请重试，记录越短越快。",
    PROVIDER: "AI 模型返回了错误。请稍后重试，或在 Anna 设置中换一个模型。",
    UNAVAILABLE: "此窗口无法使用 Anna AI。请从 Anna 仪表盘打开 ShipLog。",
    BAD_MODEL_OUTPUT: "无法读取模型的回答。请重试，或在 Anna 设置中换一个模型。",
    INVALID_REPO: "请输入 owner/repo 或 github.com 链接，例如 vercel/next.js。",
    NOT_FOUND: "找不到这个仓库。仓库必须是公开的，请检查所有者和名称。",
    RATE_LIMITED: "你所在网络的 GitHub 每小时调用上限已用完。请改为粘贴 git log 的输出，或稍后再试。",
    NO_RECENT_COMMITS: "默认分支最近 7 天没有提交。",
    NETWORK: "无法连接 GitHub。请改为粘贴你的提交记录。",
    UNKNOWN: "出了点问题，请重试。",
  },
};

const KO = {
  question: "이번 주에 무엇을 배포했나요?",
  lead: "커밋 줄이나 짧은 메모를 붙여 넣으세요. ShipLog가 X 글, LinkedIn 글, 체인지로그를 쓰고, 모든 숫자를 붙여 넣은 내용과 대조해요.",
  notesLabel: "작업 메모",
  lines: (n) => `${n}줄`,
  sample: "예시로 해 보기",
  importToggle: "GitHub에서 가져오기",
  repoLabel: "공개 GitHub 저장소",
  importBtn: "최근 7일 가져오기",
  importing: "가져오는 중…",
  privateBefore: "비공개 저장소라면 ",
  privateAfter: " 를 실행해 결과를 붙여 넣으세요. ",
  copyCommand: "명령어 복사",
  projectLabel: "프로젝트 이름",
  optional: "선택",
  projectPlaceholder: "예: Invoicer",
  toneLabel: "말투",
  tones: { "build-in-public": "빌드 인 퍼블릭", professional: "전문적", technical: "기술적" },
  langLabel: "작성 언어",
  pastWeeks: "지난 기록",
  delete: "삭제",
  historyRow: (n, project) => `${project ? `${project}: ` : ""}변경 ${n}개`,
  loadingTitle: "초안을 쓰는 중",
  steps: {
    read: (d) => `${d.changeCount}줄 읽음, 잡음 ${d.noiseCount}줄 제외`,
    draft: () => "Anna AI로 초안 작성 중",
    check: () => "숫자를 하나씩 대조하는 중",
    save: () => "기록에 저장하는 중",
  },
  headlineRest: () => "변경을 초안 3개로 정리했어요",
  skipped: (n) => `잡음 ${n}줄은 뺐어요.`,
  verdictOk: "모든 숫자가 기록과 일치해요.",
  verdictUnknown: (n) => `기록에 없는 숫자 ${n}개를 주황색으로 표시했어요. 올리기 전에 확인하세요.`,
  verdictOther: "올리기 전에 확인할 초안이 있어요. 아래 메모를 보세요.",
  drafts: { xPost: "X 글", linkedinPost: "LinkedIn 글", changelog: "체인지로그" },
  copy: "복사",
  copied: "복사됨",
  copySelected: "선택됨, Ctrl+C로 복사",
  markKnown: "기록에 있음",
  markUnknown: "기록에 없음",
  digestTitle: "ShipLog가 읽은 내용",
  cta: "초안 3개 쓰기",
  rewrite: "다시 쓰기",
  edit: "메모 수정",
  streak: (n) => `${n}주 연속`,
  preview: "미리보기 모드예요. 초안을 쓰려면 Anna 대시보드에서 ShipLog를 여세요.",
  kinds: {
    feat: ["기능"], fix: ["수정"], perf: ["속도 개선"], release: ["릴리스"],
    refactor: ["리팩터"], docs: ["문서"], test: ["테스트"], other: ["기타"],
  },
  countSep: ", ",
  countItem: (n, words) => `${words[0]} ${n}개`,
  issues: {
    UNSUPPORTED_NUMBER: (v) => `"${v}"는 기록에 없어요. 올리기 전에 확인하세요.`,
    LINKEDIN_TOO_LONG: (v) => `${v}자예요. LinkedIn은 3,000자까지예요.`,
    X_TOO_LONG: (v) => `${v}자예요. X는 280자까지예요.`,
    TOO_SHORT: () => "초안이 너무 짧아요. 다시 쓰기를 눌러 보세요.",
    EMPTY: () => "초안이 비어 있어요. 다시 쓰기를 눌러 보세요.",
    DEFAULT: () => "올리기 전에 이 초안을 확인하세요.",
  },
  errors: {
    EMPTY_NOTES: "쓸 내용이 아직 없어요. 변경을 한 줄 이상 붙여 넣으세요. 병합, 의존성 업데이트, 오타 수정은 세지 않아요.",
    QUOTA: "Anna AI 사용량을 다 썼어요. Anna 설정에서 크레딧을 추가하거나 내 키를 연결한 뒤 다시 시도하세요.",
    NOT_ALLOWED: "ShipLog에 Anna AI 사용 권한이 없어요. Anna에서 앱 권한을 확인한 뒤 다시 시도하세요.",
    TIMEOUT: "모델 응답이 너무 오래 걸렸어요. 다시 시도하세요. 메모가 짧을수록 빨라요.",
    PROVIDER: "AI 모델이 오류를 돌려줬어요. 잠시 뒤 다시 시도하거나 Anna 설정에서 다른 모델을 고르세요.",
    UNAVAILABLE: "이 창에서는 Anna AI를 쓸 수 없어요. Anna 대시보드에서 ShipLog를 여세요.",
    BAD_MODEL_OUTPUT: "모델의 답을 읽지 못했어요. 다시 시도하거나 Anna 설정에서 다른 모델을 고르세요.",
    INVALID_REPO: "owner/repo 또는 github.com 링크로 입력하세요. 예: vercel/next.js",
    NOT_FOUND: "저장소를 찾지 못했어요. 공개 저장소여야 해요. 소유자와 이름을 확인하세요.",
    RATE_LIMITED: "지금 네트워크의 GitHub 시간당 호출 한도를 다 썼어요. git log 결과를 붙여 넣거나 나중에 다시 시도하세요.",
    NO_RECENT_COMMITS: "기본 브랜치에 최근 7일 커밋이 없어요.",
    NETWORK: "GitHub에 연결하지 못했어요. 커밋을 직접 붙여 넣으세요.",
    UNKNOWN: "문제가 생겼어요. 다시 시도하세요.",
  },
};

export const MESSAGES = { en: EN, "zh-CN": ZH, ko: KO };

/** UI language from the browser: Korean, Chinese (any script → Simplified), else English. */
export function uiLocale(navLang) {
  const tag = String(navLang ?? "");
  if (/^ko/i.test(tag)) return "ko";
  if (/^zh/i.test(tag)) return "zh-CN";
  return "en";
}

/** @param {string} locale */
export function messages(locale) {
  return MESSAGES[locale] ?? EN;
}

// ---- compatibility helpers (English defaults) ----
export const ERROR_TEXT = EN.errors;

/** @param {any} err @param {string} [locale] */
export function errorText(err, locale = "en") {
  const m = messages(locale).errors;
  return m[err?.code] ?? m.UNKNOWN;
}

/** @param {{code: string, value?: string}} issue @param {string} [locale] */
export function issueText(issue, locale = "en") {
  const m = messages(locale).issues;
  return (m[issue.code] ?? m.DEFAULT)(issue.value);
}

/** "2 features, 1 fix, 1 speed-up" from summary.counts (noise excluded). */
export function countsLine(counts, locale = "en") {
  const m = messages(locale);
  const order = ["feat", "fix", "perf", "release", "refactor", "docs", "test", "other"];
  return order.filter((k) => counts?.[k]).map((k) => m.countItem(counts[k], m.kinds[k])).join(m.countSep);
}

export const STEP_TEXT = EN.steps;
export const TONE_LABELS = EN.tones;

const LANG_MAP = [
  [/^ko/i, "ko"],
  [/^ja/i, "ja"],
  [/^zh-(tw|hk|mo|hant)/i, "zh-TW"],
  [/^zh/i, "zh-CN"],
  [/^es/i, "es"],
  [/^de/i, "de"],
  [/^fr/i, "fr"],
  [/^pt/i, "pt-BR"],
];

/** Default output language for the drafts. @param {string|undefined} navLang */
export function defaultLanguage(navLang) {
  const tag = String(navLang ?? "");
  for (const [re, code] of LANG_MAP) if (re.test(tag)) return code;
  return "en";
}

export const LANGUAGE_LABELS = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  "pt-BR": "Português (Brasil)",
};

export const SAMPLE_NOTES = [
  "3f9c2e1 feat(export): download invoices as CSV (#42)",
  "8a1d4b7 feat: invite teammates by email",
  "c72e9f0 fix: checkout crashed when the cart was empty (#45)",
  "1b6f3a2 perf(dashboard): first load 3.8s -> 1.2s by caching the totals query",
  "d4e8c91 chore(deps): bump vite from 5.0.0 to 5.1.0",
  "e2a7f63 fix typo in pricing page",
  "5c0b8d4 docs: add a self-hosting guide",
  "9e3f1a7 Merge pull request #46 from dev/invites",
  "a8d2c55 release v1.4.0",
].join("\n");

export const SAMPLE_PROJECT = "Invoicer (sample)";

/** @param {string} iso @param {string} [locale] */
export function shortDate(iso, locale) {
  try {
    return new Date(iso).toLocaleDateString(locale || undefined, { month: "short", day: "numeric" });
  } catch {
    return String(iso).slice(0, 10);
  }
}
