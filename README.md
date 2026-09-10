# 鹈鹕测试

一个收录 LINUX DO 单文件 HTML 趣味测试、支持四档梗化评分的网站。

## 当前状态

- 已完成：极简单卡评分体验、普通/仙品模式、随机队列、前后切换、键盘左右键、社区比例、榜单、投稿表单、管理员登录入口、审核接线、规则持久化和下架申请入口。
- 当前默认读取 `public/works/initial/` 下的 6 个 HTML；未配置 Supabase 时也可直接运行和验收界面。
- 配置 Supabase 后，前端会加载真实作品、匿名投票、投稿、管理员审核和仙品规则。
- 当前不自动抓取 LINUX DO 内容；初始 HTML 由本地文件提供，后续通过投稿表单或管理员录入，审核后再公开。

## 本地运行

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

## Supabase 接入

1. 创建 Supabase 项目并执行 `supabase/migrations/202609100001_initial.sql`。
2. 在 Storage 中保留 `pending-html` 私有 bucket 与 `published-html` 公共 bucket。
3. 在 Auth 中开启 Anonymous sign-ins；投票与投稿使用匿名会话，不要求访客注册。
4. 配置 `SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SECRET_KEY` 后部署两个 Edge Functions（密钥只放在 Supabase 服务端环境变量中）。
5. 将 `.env.example` 复制为 `.env.local`，填写 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`；前端会自动尝试加载真实作品和投票接口。
6. 在 `admins` 表中写入唯一管理员用户的 Auth UUID。

## 设计约束

投稿 HTML 会在 `iframe sandbox="allow-scripts"` 中运行，并注入禁止外部网络、表单、弹窗和顶层跳转的 CSP。源码只允许单文件 HTML，最大 5MB。
