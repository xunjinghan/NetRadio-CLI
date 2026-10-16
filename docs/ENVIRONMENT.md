# 运行环境与网络要求（Environment & Network）

> **一句话结论**：Node.js 18+ 和 mpv 两个东西装好就能用，**不需要 npm install**（零第三方依赖）。
> 内置的 5 个电台在**中国大陆不开代理**的情况下实测全部可播（数据在下面）。
> 唯一的坑是国外电台偶尔换 CDN 导致 URL 失效 —— 那是电台的事，不是你的网络。

实测时间：2026-10-16 15:02 / 15:06（UTC+8）两轮
测试机：Windows 11 x64 · Node 20（scoop）
网络：上海 · 中国移动 AS9808 家庭宽带 · **未开任何代理**

---

## 1. 最低环境

| 组件 | 最低要求 | 我实测过的版本 | 说明 |
| --- | --- | --- | --- |
| 操作系统 | Windows 10 / macOS 12+ / Ubuntu 20.04+ | **Windows 11（唯一真机验证过的）** | 见第 2 节的平台说明 |
| Node.js | **18+** | Node 20 | 用了全局 `fetch`（Node 16/17 没有）和顶层 `await`（ESM） |
| mpv | 0.35+ | scoop 装的最新版 | 实际的播放引擎，必须有 |
| npm 依赖 | **无** | — | 不需要 `npm install`，只要 Node 能跑 `.mjs` |
| 声卡 | 有能出声的输出设备 | — | 没声音先用 `node radio.mjs log 40` 确认解码状态 |

装 mpv：

```bash
scoop install mpv     # Windows（推荐）
brew install mpv      # macOS
sudo apt install mpv  # Debian / Ubuntu
```

---

## 2. 平台说明（**重要，别踩**）

这个工具最早是按 Windows 写的，现在已经做了跨平台分支，但要如实说明：

| 平台 | 状态 | 实现方式 |
| --- | --- | --- |
| Windows | ✅ **我实测过**（播放、调音量、切台、日志都测过） | 命名管道 `\\.\pipe\dshtools-radio` + `taskkill` + 找 `mpv.exe` |
| macOS / Linux | ⚠️ **代码分支已写，但我没在真机验证过** | Unix socket `.mpv-ipc.sock` + `SIGTERM` + 找 `mpv`（`/usr/bin`、`/opt/homebrew/bin` 等） |

macOS / Linux 用户如果 `play` 或 `volume` 出问题，欢迎 [提 Issue](https://github.com/xunwmw/guichu-radio/issues/new?template=bug_report.md)
（把 `node --version`、`mpv --version`、报错原文发我），我照着修。

---

## 3. 中国大陆网络实测（**未开代理**）

### 电台流（这个工具真正的功能）

| 电台 | 结果 | 延迟 | 备注 |
| --- | --- | --- | --- |
| 中国之声 CNR-1（`ngcdn001.cnr.cn`） | ✅ HTTP 206 | 186 ms | 国内 CDN，最快 |
| 经济之声 CNR-2（`ngcdn002.cnr.cn`） | ✅ HTTP 206 | 382 ms | 同上 |
| BBC World Service（`stream.live.vc.bbcmedia.co.uk`） | ✅ HTTP 200 | 1229 ms | 能连，但音质不稳时先缓冲 |
| Classic FM（`media-ssl.musicradio.com`） | ✅ HTTP 200 | 970 ms | 可播 |
| Radio Paradise（`stream.radioparadise.com`） | ✅ HTTP 200 | 1795 ms | 可播，延迟最高 |

### 搜台用的目录服务（`node radio.mjs search`）

| 节点 | 结果 | 延迟 |
| --- | --- | --- |
| `de1.api.radio-browser.info` | ✅ 可用 | 893 ms |
| `all.api.radio-browser.info` | ❌ 连接被重置 | — |
| `nl1.api.radio-browser.info` | ❌ DNS 解析失败 | — |

> 所以代码里加了**节点降级**：依次试 de1 → all → nl1，第一个能用就用它；
> 全都不通时会告诉你原因，并提示你可以只用自己的 `stations.json`（内置电台不需要联网搜台）。

### 装 Node / mpv 时的下载源

| 域名 | 结果 | 延迟 |
| --- | --- | --- |
| `nodejs.org` | ✅ | 706 ms |
| `mpv.io` | ✅ | 716 ms |
| `scoop.sh` | ✅ | 640 ms |
| `objects.githubusercontent.com`（Release 附件） | ✅ | 425 ms |
| `github.com`（网页 / HTTPS 克隆） | ⚠️ TLS 握手超时 | — |
| `codeload.github.com`（Download ZIP） | ❌ 超时 | — |

---

## 4. 官方安装链接 + 直连不通时用官方 WARP

| 工具 | 官方链接 | 国内直连（实测） |
| --- | --- | --- |
| Node.js 18+ | <https://nodejs.org/> | ✅ 706 ms（国内镜像 <https://npmmirror.com/mirrors/node/>） |
| mpv | <https://mpv.io/installation/> | ✅ 716 ms |
| Scoop（Windows 装 mpv 用） | <https://scoop.sh/> | ✅ 640 ms |
| Git | <https://git-scm.com/downloads> | 未实测（Windows 一般已自带） |

### 直连不通时：用**官方** WARP（别装第三方"加速器"）

| 官方入口 | 国内直连（实测） | 说明 |
| --- | --- | --- |
| `1.1.1.1`（WARP 官网） | ❌ **超时** | 官网在国内打不开，**这不是你的网络坏了** |
| `www.cloudflare.com` | ✅ 848 ms | 官网主页可开 |
| `developers.cloudflare.com` | ✅ 785 ms | 官方文档站，含各平台安装步骤 |
| `install.appcenter.ms` | ✅ 1583 ms | 官方安装包托管（Microsoft App Center） |

Windows 一条命令装（不需要翻墙）：

```powershell
winget install --id Cloudflare.Warp -e
```

> ⚠️ 别敲 `scoop install warp`：scoop 里那个 `warp` 是另一个不相干的工具（0.3.0）。

装完确认生效：

```powershell
& "C:\Program Files\Cloudflare\Cloudflare WARP\warp-cli.exe" status   # 期望 Connected
```

或打开 <https://www.cloudflare.com/cdn-cgi/trace> 看到 `warp=on`。

**注意**：听电台**不需要** WARP（5 个内置电台国内直连实测全部可播，BBC 1229 ms 也通）；只有 `git clone` 卡住或想听被墙的国外台时才有用。免费档出口可能绕远，音质反而更差。

---

## 5. 常见报错 → 处理

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `找不到 mpv.exe`（Windows） | mpv 没装或不在 PATH | `scoop install mpv`，或从 [mpv.io](https://mpv.io/installation/) 下 |
| `找不到 mpv`（macOS/Linux） | 没装 mpv | `brew install mpv` / `sudo apt install mpv` |
| `fetch is not defined` / 语法报错 | Node 版本太旧（16/17） | 升到 Node 18+ |
| 不出声，但 `status` 显示在播 | 电台换 CDN / 被限速 | `node radio.mjs log 40` 看是不是 404/超时；换台试 |
| `volume` 报失败 | mpv 进程被手动关了 | 重新 `play` |
| `git clone` 卡住 | `github.com` 握手被干扰 | 开代理 / 用 SSH / 下 Release 附件 |
| 搜台报「所有目录节点都没连上」 | 目录服务节点不通 | 用内置电台（`play 1`），或设 `RADIO_BROWSER_API=https://de1.api.radio-browser.info` |

---

## 6. 合规

接收公开广播自用一般没问题；**转播受版权保护的节目、或接收并解密他人加密通信，是另一回事**。
这个工具定位是"自己听"。

---

## English summary

- Needs Node.js 18+ (global `fetch`) and mpv. **No npm dependencies.**
- Windows is the tested platform (named pipe + `taskkill` + `mpv.exe`). macOS/Linux branches were added (Unix socket + `SIGTERM` + `mpv` lookup) but **not verified on real hardware** — issues welcome.
- Mainland-China direct connection (no proxy): all 5 built-in stations playable (CNR 186–382 ms, BBC 1229 ms, Classic FM 970 ms, Radio Paradise 1795 ms).
- The search directory `de1.api.radio-browser.info` works (893 ms); `all.` / `nl1.` nodes are reset / not resolvable — the CLI now falls back across nodes.
- `nodejs.org`, `mpv.io`, `scoop.sh` and GitHub Release attachments are reachable; `github.com` HTTPS clone is unstable and `codeload.github.com` (Download ZIP) times out.
