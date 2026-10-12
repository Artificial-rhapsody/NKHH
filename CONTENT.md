# 网页内容编辑说明

## 按页面区块组织

`site.json` 的结构对应页面，不再建立全局图片表或无障碍文字表：

```text
meta                         页面标题、语言
header                       品牌、导航、菜单文案
sections
  hero                       首页：标题、正文、图片、按钮、标注
  intro                      简介：正文、背景图、圆形图片、遮罩、按钮
  layouts                    双列：背景图、mainCard、copy、sideCard
  videos                     横向展示：标题、控制按钮、cards 完整卡片数组
  thanks                     致谢：标题、名单、按钮
footer                       页脚
videoDialog                  公共弹窗框架文案
```

## 一项就是一张完整卡片

`sections.videos.cards` 的每个对象包含这一张卡片的全部内容：

```json
{
  "videoId": "01",
  "image": {
    "src": "assets/images/video-01.jpg",
    "alt": "封面描述",
    "placeholder": "图片 01"
  },
  "number": "01",
  "duration": "--:--",
  "title": "视频标题",
  "caption": "视频 01",
  "description": "视频描述",
  "openLabel": "打开视频 01 预览",
  "preview": {
    "title": "视频 01 · 预览",
    "label": "视频 01"
  }
}
```

图片、文字、标注、点击目标编号、打开按钮说明、预览文字都跟随同一个卡片对象。
可直接增删或调整 `cards` 数组顺序，页面会生成相应卡片，无需改 HTML。
`layouts.mainCard` 与 `layouts.sideCard` 同样各自包含图片与卡片文字；右侧文字块的按钮打开主卡片。
当前视频仍是占位预览，没有增加实际播放器或上传后台。

## 替换真实图片

找到所属区块或卡片的 `image.src`，把 URL 改成真实文件路径即可：

- 首页：`sections.hero.image.src`
- 简介背景：`sections.intro.backgroundImage.src`
- 简介圆图：`sections.intro.image.src`
- 毛边遮罩：`sections.intro.maskImage.src`，当前为 `assets/images/intro-mask.png`
- 双列背景：`sections.layouts.backgroundImage.src`
- 主卡片：`sections.layouts.mainCard.image.src`
- 紧凑卡片：`sections.layouts.sideCard.image.src`
- 横向卡片：`sections.videos.cards[对应序号].image.src`

例：把图片放进工作目录下的 `assets/images/hero.jpg`，填写 `"src": "assets/images/hero.jpg"`。
也可以填写完整 HTTPS URL。不存在 random 开关、seed、template 或尺寸生成配置，JS 不会改写图片 URL。
原随机图片 API 仅作为一个普通完整 URL 占位；将它替换掉即可。
`alt` 是替代文字，`placeholder` 是加载失败时显示的占位提示。

双列背景的 `src` 为空时自动沿用主卡片图片；若需要独立背景，直接填写自己的 `src`，无需设置引用键。
图片显示比例与样式由 CSS 控制；尺寸属性留在 HTML，不属于内容编辑项。

## 编辑文字

字符串是普通文字；数组表示逐行换行的文字。所有内容按纯文本渲染，不解析 HTML。
无障碍文案放在所属区块/控件中。弹窗打开后的专属文字放在对应卡片的 `preview` 中。
致谢名单目前沿用原来的 12 个固定位置；本次动态数量支持针对横向卡片数组。
SVG 界面图标及字体仍属于设计资源，分别保留在 HTML 与 CSS。

## 查看与验证

```bash
cd "/home/nelu/Bussiness/王嘉平-故事采访"
python3 -m http.server 8000
```

打开 `http://localhost:8000/`，或使用 VS Code Live Server。需要 HTTP 加载 JSON，不使用 `file://`。

```bash
python3 test_content.py
node --check script.js
```
