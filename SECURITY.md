# 安全政策 · Security Policy

NetRadio-CLI 是本地命令行电台播放器（Node.js + mpv），不涉及服务端与账号体系。

## 报告问题

- 播放/搜索功能问题：开 Issue（Bug 模板），附 `node radio.mjs --help` 输出与报错原文
- 电台源接口变化：同样开 Issue，说明你的网络环境

## 使用边界

- 电台源为公开网络广播，请遵守各源站点使用条款
- 不要把个人路径、Token 或私密播放列表提交进仓库（CI 会做一次凭据扫描）
