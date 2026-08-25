# 颜浩宇 · 习惯打卡（苹果风格）

每天打开，勾选三项习惯：**初级会计 · 备考**、**英语六级 · 学习**、**小提琴 · 练习**。
页面默认只读，输入密码后才能打勾；支持历史日历、连续打卡统计与跨设备云端同步。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| index.html | 页面结构 |
| styles.css | 苹果风格样式（浅色/深色自动切换） |
| app.js | 全部逻辑（打卡、日历、统计、云端同步） |
| config.js | **需要你修改**：Supabase 地址、密钥、默认密码 |
| manifest.webmanifest / icons/ | 手机「添加到主屏幕」用 |
| supabase/schema.sql | 数据库建表 SQL |
| preview.ps1 | 本地预览服务器 |

---

## 第一步：配置云端数据库（Supabase，免费）

1. 打开 https://supabase.com 注册账号（免费）。
2. 新建项目：`New project`，随便起名（如 habit-tracker），设置数据库密码后创建。
3. 等项目创建完成后，点左侧 **SQL Editor** → `New query`，把 `supabase/schema.sql` 里的内容整段粘贴进去，点 **Run**。
4. 点左侧 **Settings** → **API**，复制 **Project URL** 和 **anon public key**。
5. 打开 `config.js`，把两处引号里的内容替换：

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...你的anon密钥",
```

> 说明：不配置也能用，数据会只保存在打开网页的那台设备上（页面顶部会提示「未连接云端」）。

---

## 第二步：部署到 GitHub Pages（免费公网网址）

1. 打开 https://github.com 注册账号（若还没有）。
2. 点右上角 **+** → **New repository**，名字随意（如 `habit-tracker`），选 **Public**，创建。
3. 在新仓库页面点 **Add file** → **Upload files**，把本目录下这些**文件和文件夹**拖进去：
   `index.html`、`styles.css`、`app.js`、`config.js`、`manifest.webmanifest`、`preview.ps1`、`README.md`、`icons/`（整个文件夹）、`supabase/`（整个文件夹）
4. 点 **Commit changes**。
5. 点仓库 **Settings** → 左侧 **Pages** → Source 选 **Deploy from a branch** → Branch 选 `main`、目录 `/ (root)` → **Save**。
6. 等 1–2 分钟，刷新页面，就能看到你的网址：
   `https://你的用户名.github.io/habit-tracker/`

之后手机、电脑打开这个网址都能看到**同一份打卡数据**；别人打开也能查看。

---

## 使用说明

- 点任一习惯右侧的圆圈打勾/取消；**未解锁时**会先弹出密码框。
- 默认密码 `8888`；点右上角齿轮 ⚙ →「修改密码」可改（4–6 位数字，会同步到云端）。
- 日历：点过去日期查看当天完成情况（不能修改过去）；左右箭头切换月份。
- 顶部「编辑中」按钮可随时重新锁定。

> ⚠️ 密码只是防止误改：它是存在网页前端里的，懂技术的人可以看到源码绕过，请不要把它当银行密码用。

## 本地预览（可选）

```powershell
powershell -ExecutionPolicy Bypass -File preview.ps1
```
浏览器打开 http://localhost:8080/

---

## 快速公网发布（免费，无需注册）

用 Windows 自带功能即可把网站发布成公网网址（任何人打开链接都能浏览）：

``powershell
powershell -ExecutionPolicy Bypass -File "公开上线.ps1"
``

运行后屏幕上会显示一个 https://xxxx.lhr.life 网址，把它发给朋友即可。

> 注意：
> - 网址是临时的：电脑关机或按 Ctrl+C 停止后失效，下次运行会得到一个新网址。
> - 要永久固定网址，请按上面「第二步：部署到 GitHub Pages」操作（免费，注册 GitHub 即可）。
