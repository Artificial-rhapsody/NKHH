# 本地注册登录与管理员编辑

本次只实现本地验收，不部署 Cloudflare、不提交或推送 GitHub。GitHub Pages 仍为计划中的静态托管；Workers 仅做认证。正式线上发布写回 GitHub 的服务尚未接入。

## 启动

项目目录：`/home/nelu/Bussiness/王嘉平-故事采访`

首次安装与建表：

```bash
npm install
npm run db:init
```

终端一：

```bash
npm run worker:dev
```

终端二：

```bash
npm run dev
```

打开 `http://127.0.0.1:8000/`。不要使用 file://、普通 Python server 或 Live Server 来验收认证和发布；它们不提供本地 API 代理及写入服务。

## 首个管理员

1. 在主页导航栏点击登录，切换注册，填写用户名、邮箱和至少 10 位密码。
2. 注册固定为 user，不会自动成为管理员。
3. 在项目目录执行（替换为刚注册的邮箱）：

```bash
npm run admin:promote -- your@email.example
```

4. 退出后重新登录，admin 自动跳到 `admin.html`。

此提升命令只操作本地 D1；没有默认管理员或默认密码。

## 编辑

- 点击预览中带虚线框的文字、图片或按钮，在右侧表单修改；预览即时刷新。
- 全部内容与隐藏属性可编辑 site.json 中所有叶子字段，包括网页标题、alt、href、无障碍说明、背景、遮罩、弹窗。
- 列表支持添加、删除、上移、下移；保留必要最小项数。
- 桌面／手机预览切换；撤销全部修改；离开时提示未发布草稿。
- 底部总确认才覆盖当前目录 site.json；服务验证实时 admin 身份、来源、内容结构和版本号，原子写入并回读。
- 上传视频只有入口与尚未实现说明。
- 图片本次填写现有本地资源路径或 HTTPS URL，不提供图片／视频上传。
- 本地发布后的内容属于工作区变更，线上 GitHub Pages 不会自动更新。

## 安全与数据

D1 users 存 id、username、email、role、password_hash、salt、created_at；密码以 scrypt 哈希存储，API 不返回密码或哈希。会话随机生成，数据库只存令牌 SHA-256，24 小时过期，退出即撤销。为支持 GitHub Pages 与 Worker 跨域，会话放在当前标签页 sessionStorage，不使用跨站 Cookie；关闭标签页不保留登录。管理员鉴权每次读取数据库角色。

config.js 的 apiBase 在本地走同源代理，未来部署必须配置实际 Worker HTTPS 地址，同时将 Pages 精确 Origin 加入 Worker ALLOWED_ORIGINS。publishBase 的线上功能尚未接入，不要填入假地址。

本地数据库位于 workers/.wrangler/，已忽略入 Git。Workers database_id 当前为本地占位 ID，部署前必须创建真实 D1 并配置，不能直接部署当前配置。

## 测试

运行服务后：

```bash
npm test
npm run check
python3 test_content.py
npm run test:e2e
npm run build:worker
```

浏览器 E2E 使用随机临时测试密码，不读取真实凭据；验证注册、登录、管理员提升、权限、全部字段控件、点选预览、发布回读、冲突、列表和手机预览；结束通过鉴权发布还原内容并删除测试账户。

## 已知开发环境限制

Wrangler 4.107.0 的运行时仅支持到 2026-07-08 兼容日期，配置因此固定此日期。本机升级 Wrangler 4.149.0 时依赖下载超时／缺 workerd 可执行包，已恢复可运行的 4.107.0。npm audit 报其开发依赖 4 个漏洞（1 moderate、3 high）；生产依赖 audit 为 0。开发服务只绑定本机，不应暴露公网；线上阶段需成功升级工具链并重新测试。

原主页占位字体没有改动，部分中文映射仍是原项目占位字形；管理员界面使用系统中文字体。
