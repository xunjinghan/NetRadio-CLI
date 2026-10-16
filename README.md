# NetRadio-CLI — 命令行网络收音机

**EN** — A command-line internet radio player (mpv + Node.js): search stations globally, change volume without restarting playback.

> 一个用 Node.js + mpv 写的命令行网络收音机。全球几万个电台，一行命令收听，调音量不打断播放。

![Node.js](https://img.shields.io/badge/node-16+-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![电台](https://img.shields.io/badge/内置电台-5个实测-orange)
![搜索](https://img.shields.io/badge/全球搜索-几万个-purple)

---

## 这是什么？

一个极简的命令行网络收音机工具。不需要 GUI，不需要浏览器，一行命令就能听全球电台。

核心特性：

- **零 GUI**：纯命令行，适合服务器、远程桌面、终端用户
- **调音量不打断播放**：通过 mpv 的 IPC 命名管道实时控制
- **内置实测电台**：5 个电台全部经过连通性测试，不是抄来的 URL
- **全球搜索**：调用在线目录，搜索几万个电台
- **状态持久化**：当前播放、音量、开始时间存在 `.state.json`

---

## 一分钟上手

```bash
# 看内置电台
node radio.mjs list

# 收听 1 号（中国之声）
node radio.mjs play 1

# 当前在播什么
node radio.mjs status

# 调音量（不用重启播放）
node radio.mjs volume 50

# 切下一台
node radio.mjs next

# 关掉
node radio.mjs stop
```

搜索全球电台（在线目录，几万个台）：

```bash
node radio.mjs search jazz 15      # 搜关键词
node radio.mjs play https://...    # 直接粘搜索结果里的 URL 播放
```

---

## 内置电台（全部实测过）

| 编号 | 电台 | 类型 | 实测状态 |
|---|---|---|---|
| 1 | 中国之声 CNR-1 | 新闻综合 | HTTP 206 / 56ms |
| 2 | 经济之声 CNR-2 | 财经 | HTTP 206 / 133ms |
| 3 | BBC World Service | 国际新闻 | HTTP 200，15s 收 159KB |
| 4 | Classic FM (UK) | 古典 | HTTP 200，15s 收 433KB |
| 5 | Radio Paradise | 摇滚/综合 | HTTP 200，15s 收 261KB |

**实测不通、已剔除**：RTHK 香港电台 1 台（连接超时）、SomaFM（空响应）。

> 不往配置里塞没验证过的 URL——那种"点一个死一个"的收音机，不如没有。

---

## 命令大全

| 命令 | 说明 | 示例 |
|---|---|---|
| `list` | 列出内置电台 | `node radio.mjs list` |
| `play <编号或URL>` | 播放指定电台 | `node radio.mjs play 1` |
| `stop` | 停止播放 | `node radio.mjs stop` |
| `status` | 查看当前状态 | `node radio.mjs status` |
| `volume <0-100>` | 调音量（不重启） | `node radio.mjs volume 50` |
| `next` | 切下一台 | `node radio.mjs next` |
| `prev` | 切上一台 | `node radio.mjs prev` |
| `search <关键词> [数量]` | 搜索全球电台 | `node radio.mjs search jazz 15` |
| `log [行数]` | 查看 mpv 日志 | `node radio.mjs log 40` |

---

## 实现原理

- **播放器**：[mpv](https://mpv.io/)（跨平台、高性能、支持 IPC）
- **控制方式**：mpv 的 **IPC 命名管道** `\\.\pipe\dshtools-radio`（Windows）/ Unix Socket（Linux/macOS）
- **状态文件**：`.state.json`（pid / 电台 / 音量 / 开始时间）
- **日志**：`mpv.log`

### 怎么判断"真的在出声"？

进程活着不代表有声音。判断标准是看 `mpv.log` 里有没有：

```
AO: [wasapi] 44100Hz stereo 2ch float
audio ready
starting audio playback
```

`AO: [wasapi]` 表示音频输出设备已打开，`starting audio playback` 表示真的开始播放了。

---

## 安装

### 1. 安装 mpv

**Windows**（推荐 scoop）：
```bash
scoop install mpv
```

或从 [mpv 官网](https://mpv.io/installation/) 下载。

**macOS**：
```bash
brew install mpv
```

**Linux**：
```bash
sudo apt install mpv    # Debian/Ubuntu
sudo pacman -S mpv      # Arch
```

### 2. 安装 Node.js

需要 Node.js 16+。从 [nodejs.org](https://nodejs.org/) 下载或用包管理器安装。

### 3. 克隆并运行

```bash
git clone https://github.com/xunwmw/NetRadio-CLI.git
cd NetRadio-CLI
node radio.mjs list
```

---

## 配置

电台列表在 `stations.json`，可以自行添加：

```json
[
  {
    "name": "电台名称",
    "url": "https://stream-url.com/stream",
    "genre": "类型",
    "verified": "2026-10-12",
    "note": "实测备注"
  }
]
```

建议添加前先用 `curl -I` 测试连通性。

---

## 已知限制

1. **不是无线电**：所有频道都依赖互联网。断网即静音。收真实空中信号需要 SDR 硬件（见下）。
2. **流媒体 URL 会失效**：电台换 CDN 是常态。碰见不出声先 `node radio.mjs log 40`，看是不是 404/超时。
3. **`volume` 依赖 mpv 存活**：mpv 被手动关掉后，`volume` 会报失败；重新 `play` 即可。
4. **同一时刻只播一个台**：`play` 会先杀掉上一个（设计如此，避免两个台叠着响）。

---

## 想听真实的短波/FM？

本工具是网络收音机，收的是互联网流。想听真实的无线电波，有两档选择：

### 档 1：零成本——用别人的接收机（WebSDR / KiwiSDR）

不需要任何硬件，网页上就能调频率、听真实的短波广播、业余无线电、航空通信。

- Twente WebSDR（荷兰，最老牌）：http://websdr.ewi.utwente.nl:8901/
- KiwiSDR 公共节点目录：http://kiwisdr.com/public/

### 档 2：花钱——买 RTL-SDR，自己收

| 硬件 | 参考价 | 能听什么 |
|---|---|---|
| 普通 DVB-T 棒（RTL2832U + R820T2） | ¥40–70 | FM 广播、部分航空/对讲 |
| RTL-SDR Blog V3/V4（推荐） | ¥120–220 | 上面全部 + 更好的灵敏度与带宽 |
| 天线（选购） | ¥30–100 | 决定你能收多远 |

买回来后要装：Zadig（换 WinUSB 驱动）+ SDR 软件（SDR# / SDR++ / gqrx）。

**注意**：RTL-SDR 收不到加密的数字集群通信（警用/部分对讲），那不是设备问题，是加密。

---

## 合规提醒

接收公开广播（FM/短波/航空/业余无线电）在本机自用一般无碍；**接收并解密他人加密通信、或转播受版权保护的节目内容，是另一回事**。

本工具定位是"自己听"，别拿去做转播。

---

## 项目结构

```
NetRadio-CLI/
├── radio.mjs       # 主程序（~200 行）
├── stations.json   # 内置电台列表（全部实测过）
├── README.md       # 本文件
├── .state.json     # 运行时状态（已加入 .gitignore）
└── mpv.log         # 运行时日志（已加入 .gitignore）
```

---

## 相关项目

- [bounty-forge](https://github.com/xunwmw/bounty-forge) — AI 驱动漏洞挖掘知识库与实战工具集
- [WebVulnLab](https://github.com/xunwmw/WebVulnLab) — 自研 Web 漏洞靶场
- [VulnScope](https://github.com/xunwmw/VulnScope) — AI 自动化漏洞挖掘工具集

---

## 许可证

[MIT License](LICENSE)
