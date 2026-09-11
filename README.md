# 鹈鹕测试

一个收录 LINUX DO 单文件 HTML 趣味测试的纯静态展示站。

## 当前状态

- 首页只读取 `public/works/initial/` 下的 6 个预设 HTML。
- 页面不连接数据库、不需要登录，也不包含投稿和审核后端。
- 页面内的评分仅用于当前浏览器中的临时预览，刷新后不会保存。
- 推送到 `main` 后，GitHub Actions 会自动构建并发布到 GitHub Pages。

## 本地运行

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

## 更新方式

`main` 分支用于已发布版本。后续新增或修改展示内容时，请从其他分支提交 Pull Request；通过检查并经仓库管理员审核后，再合并到 `main`。

预设页面放在 `public/works/initial/`，文件名按 `001.html` 到 `006.html` 管理。新增页面时，同时更新 `src/lib/initialWorks.ts` 中的页面清单。

## 预览安全

预设 HTML 会在 `iframe sandbox="allow-scripts"` 中运行，并注入禁止外部网络、表单、弹窗和顶层跳转的 CSP。
