# 本地认证与可视化编辑 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 实现 Workers 注册登录、管理员鉴权与主页点选编辑、实时预览、统一发布。

**Architecture:** GitHub Pages 继续托管静态页面，Workers + D1 只提供认证。跨域使用随机 opaque Bearer 会话，数据库只存会话令牌 SHA-256；浏览器 sessionStorage 保存当前会话。本地 Node 服务代理 /api 到本地 Wrangler，并在 Workers 验证当前 admin 后原子更新当前目录 site.json。线上发布不在本次范围，不写远程 GitHub。

**Tech Stack:** 原生 HTML/CSS/JS、Cloudflare Workers、D1、Node test runner、Playwright。

## 协作契约
- POST /api/auth/register {username,email,password} -> 201 {user}；不自动授予 admin。
- POST /api/auth/login {identifier,password} -> {token,user}。
- GET /api/auth/me Authorization: Bearer -> {user}。
- POST /api/auth/logout Authorization: Bearer -> {ok:true}。
- user={id,username,email,role}，role 为 user/admin，绝不返回密码哈希。
- GET /api/admin/check Authorization: Bearer -> {user}，非 admin 返回 403。
- 页面共享 window.SiteAuth：ready Promise、request(path,options)、getUser()、logout()。会话键 story.session。
- 页面配置 config.js：window.APP_CONFIG={apiBase:'',publishBase:''}；本地代理同源，线上必须明确配置认证地址；未配置线上发布应提示不可用。
- GET /__local/content -> {site,revision}，revision 为源文件 SHA-256。
- POST /__local/publish {site,revision} + Authorization -> {site,revision}。必须验证 Origin、管理员、schema、版本冲突，发布后读取验证。
- admin.html 用 iframe index.html?editor=1 展示原样主页。同源父子通信握手并严格检查 origin/source。
- 预览 API window.SitePage={getSite(),render(site)}；render 可重复执行，不重复正文、卡片或事件。
- 子页面点击绑定元素发送 {type:'editor:select',paths:[...]}；父页发送 {type:'editor:render',site}；公开页不能接受编辑消息。

## 任务与验证
1. 认证后端：逐行为 TDD；D1 users/sessions/rate_limits，参数化 SQL、加盐密码哈希、会话过期/撤销、注册固定 user、限制请求大小、精确 CORS 白名单。提供按邮箱提升管理员命令。
2. 登录前端：导航第四项改登录；注册/登录 dialog、确认密码、错误与提交状态、admin 自动跳转、user 正常停留、退出；不改原页面视觉。
3. 可视化编辑：可重复渲染、绑定元素外框点选、语义表单覆盖 site.json 所有叶子字段，包括不可见属性；数组增删排序；实时草稿、重置、未保存提示、页面底部确认发布、401/403/409 错误；上传视频只显示未实现说明。
4. 本地发布桥：TDD，固定唯一目标 site.json，版本保护、只允许同源请求、Worker 鉴权、严格结构与 URL 检查、原子写入及回读；静态文件不暴露源码/数据库/凭据。
5. 验证：已有 Python 测试、Node 单元/集成测试、Wrangler 本地 D1 实测、浏览器注册/登录/越权/点选/预览/发布/回读/恢复测试，dry-run；不提交、不部署。

## 范围
只修改当前项目目录，依赖和本地 D1 数据忽略入 Git。管理员由明确命令授权，不创建默认密码、不提升首位用户。原字体设计不在本阶段修改。
