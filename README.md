# 🎰 3D 推币机 · Coin Pusher Casino

一个本地运行的 **3D 推币机 + 老虎机** 网页游戏。绿色机身、金色硬币、紫色推板，配合顶部老虎机转盘，还原电玩城街机的复古感觉。

基于 **Three.js**（3D 渲染）+ **cannon-es**（真实刚体物理）构建，所有依赖都已本地化，**断网也能玩**。

## ✨ 玩法

- 👆 **点击 3D 画面** → 在对应位置投币（可瞄准左右位置）
- 🟡 或点底部大金钮「投币」→ 随机位置投币
- 🎰 每次投币，顶部**老虎机**自动转动，3 个相同符号中奖 → 掉落奖励币
- 🟣 紫色推板来回运动，把硬币推下前端边缘 → 得分

### 老虎机中奖表（30% 中奖率）

| 符号 | 奖励硬币 |
|------|---------|
| 7️⃣ | 50 |
| 💎 | 40 |
| ⭐ | 30 |
| 🍉 | 25 |
| 🍊 🍋 🍒 | 20 |

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 3D 渲染 | Three.js (r182) |
| 物理引擎 | cannon-es (0.20) |
| 音效 | Web Audio API（程序合成，无音频文件） |
| 架构 | 纯静态 HTML/CSS/JS + Import Map（无构建步骤） |

## 🚀 本地运行

```bash
# 任意静态服务器即可，例如：
cd coin-pusher-3d
python3 -m http.server 8766
# 浏览器打开 http://localhost:8766
```

> 💡 macOS 提示：如果想一键启动，可以在桌面放一个 `.command` 文件，内容写 `cd <本项目路径> && python3 -m http.server 8766`，然后 `chmod +x` 双击即可。

## 📁 文件结构

```
coin-pusher-3d/
├── index.html          # 页面结构 + 老虎机 UI
├── style.css           # Casino 风格样式
├── main.js             # 游戏主逻辑（3D 场景 + 物理 + 老虎机）
└── vendor/             # 本地化的第三方库（离线可玩）
    ├── three.module.js # Three.js ESM 主文件
    ├── three.core.js   # Three.js core（three.module.js 的依赖）
    └── cannon-es.js    # 物理引擎
```

## ⚠️ 小提示

Three.js 新版（r168+）的 `three.module.js` **不是自包含的**，它内部 `import from './three.core.js'`，所以 `vendor/` 里两个文件都要有，否则会白屏。
