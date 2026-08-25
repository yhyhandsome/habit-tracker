// ============================================================
//  颜浩宇 · 习惯打卡 — 配置文件
//  部署前把下面两项改成你自己的 Supabase 信息：
//  （Supabase 控制台 → Settings → API → Project URL / anon public key）
// ============================================================

window.APP_CONFIG = {
  // Supabase 项目地址，例如 "https://xxxx.supabase.co"
  SUPABASE_URL: "",

  // Supabase anon public key
  SUPABASE_ANON_KEY: "",

  // 主人姓名（页面大标题）
  USER_NAME: "颜浩宇",

  // 默认密码（部署后可在页面「设置」里修改，存到云端）
  DEFAULT_PIN: "8888",

  // 三项习惯：id 必须与数据库列名一致（accounting / english / violin）
  HABITS: [
    { id: "accounting", name: "初级会计", note: "备考 · 学习", emoji: "📘" },
    { id: "english", name: "英语六级", note: "学习 · 刷题", emoji: "📖" },
    { id: "violin", name: "小提琴", note: "练习", emoji: "🎻" }
  ]
};
