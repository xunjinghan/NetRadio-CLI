#!/usr/bin/env node
/**
 * radio.mjs —— 本机网络收音机（mpv 驱动）
 *
 * 用法：
 *   node radio.mjs list                    列出内置电台（编号/名称/语种/类型）
 *   node radio.mjs search <关键词> [数量]   在线目录搜索（radio-browser，de1 节点）
 *   node radio.mjs play <编号|名称|URL>     开始收听（自动停掉上一个）
 *   node radio.mjs stop                    停止收听
 *   node radio.mjs status                  当前状态（PID 存活 / 电台名 / 音量 / 已播时长）
 *   node radio.mjs volume <0-100>          调节音量（走 mpv IPC，不用重启播放）
 *   node radio.mjs next                    切到内置列表的下一台
 *   node radio.mjs log [行数]               看 mpv 日志尾部（判断是否真的解码出音频）
 *
 * 说明：走互联网电台流，不是无线电波。听真实短波/FM 见 README.md 的 WebSDR 章节。
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(DIR, '.state.json');
const LOG_FILE = path.join(DIR, 'mpv.log');
const PIPE = '\\\\.\\pipe\\dshtools-radio';
const PIPE_ARG = '--input-ipc-server=' + PIPE;

function findMpv() {
  // 1. PATH 里找
  const pathDirs = (process.env.PATH || '').split(';');
  for (const d of pathDirs) {
    const p = path.join(d, 'mpv.exe');
    if (fs.existsSync(p)) return p;
  }
  // 2. scoop 常见安装路径（用 %USERPROFILE%，不硬编码用户名）
  const userProfile = process.env.USERPROFILE || 'C:\\Users\\Administrator';
  const shim = path.join(userProfile, 'scoop', 'shims', 'mpv.exe');
  if (fs.existsSync(shim)) return shim;
  const apps = path.join(userProfile, 'scoop', 'apps', 'mpv');
  if (fs.existsSync(apps)) {
    for (const v of fs.readdirSync(apps)) {
      const p = path.join(apps, v, 'mpv.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('找不到 mpv.exe，先运行：scoop install mpv  或  choco install mpv');
}

function loadStations() {
  return JSON.parse(fs.readFileSync(path.join(DIR, 'stations.json'), 'utf8'));
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}

function writeState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
function clearState() { try { fs.unlinkSync(STATE_FILE); } catch {} }

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killTree(pid) {
  if (!pid) return;
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
}

function stop(silent) {
  const s = readState();
  if (s && isAlive(s.pid)) {
    killTree(s.pid);
    if (!silent) console.log(`已停止：${s.name}（pid=${s.pid}）`);
  } else if (!silent) {
    console.log('当前没有在播的电台。');
  }
  clearState();
}

function play(station, volume) {
  const mpv = findMpv();
  const st = readState();
  const vol = volume ?? st?.volume ?? 80;
  stop(true);

  const args = [
    '--no-video', '--force-window=no', '--really-quiet',
    '--network-timeout=30', '--cache=yes', '--cache-secs=10',
    PIPE_ARG, '--volume=' + vol,
    '--log-file=' + LOG_FILE,
    station.url,
  ];
  const child = spawn(mpv, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  writeState({
    pid: child.pid, name: station.name, url: station.url,
    volume: vol, startedAt: new Date().toISOString(),
  });
  console.log(`▶ 正在收听：${station.name}`);
  console.log(`  音量 ${vol} | pid=${child.pid} | ${station.url}`);
  console.log('  停止：node radio.mjs stop   看状态：node radio.mjs status');
}

function ipc(command, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const sock = net.connect(PIPE);
    let buf = '';
    let done = false;
    const finish = (v) => { if (!done) { done = true; try { sock.destroy(); } catch {} resolve(v); } };
    sock.setTimeout(timeoutMs, () => finish(null));
    sock.on('connect', () => sock.write(JSON.stringify(command) + '\n'));
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      const nl = buf.indexOf('\n');
      if (nl >= 0) {
        try { finish(JSON.parse(buf.slice(0, nl))); } catch { finish(null); }
      }
    });
    sock.on('error', () => finish(null));
    sock.on('close', () => finish(null));
  });
}

async function status() {
  const s = readState();
  if (!s) return console.log('状态：空闲（没有在播的电台）');
  const alive = isAlive(s.pid);
  const mins = Math.round((Date.now() - new Date(s.startedAt).getTime()) / 60000);
  console.log(`状态：${alive ? '在播' : '进程已退出（异常）'}`);
  console.log(`  电台：${s.name}`);
  console.log(`  URL ：${s.url}`);
  console.log(`  pid ：${s.pid}  |  音量：${s.volume}  |  已播约 ${mins} 分钟`);
  if (alive) {
    const r = await ipc({ command: ['get_property', 'media-title'] });
    if (r && r.data != null) console.log(`  mpv 报告当前媒体：${r.data}`);
  }
}

async function setVolume(v) {
  const s = readState();
  if (!s || !isAlive(s.pid)) return console.log('没有在播的电台，先 play。');
  const r = await ipc({ command: ['set_property', 'volume', v] });
  if (r && r.error === 'success') {
    s.volume = v; writeState(s);
    console.log(`音量已设为 ${v}`);
  } else {
    console.log('调音量失败（mpv IPC 无响应）。可先 stop 再用 play 重启。');
  }
}

function showLog(lines) {
  if (!fs.existsSync(LOG_FILE)) return console.log('还没有日志（没播放过）。');
  const all = fs.readFileSync(LOG_FILE, 'utf8').split(/\r?\n/);
  console.log(all.slice(-lines).join('\n'));
}

function list() {
  const st = loadStations();
  console.log('内置电台（编号用于 play）：');
  st.forEach((s, i) => console.log(`  [${i + 1}] ${s.name}  · ${s.genre} · ${s.lang}`));
  console.log('\nplay 也支持直接给关键词或完整 URL，例如：node radio.mjs play bbc');
}

async function search(q, limit) {
  const url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(q)}&limit=${limit}&hidebroken=true`;
  const res = await fetch(url, { headers: { 'User-Agent': 'dsh-radio/1.0' } });
  if (!res.ok) throw new Error('目录服务返回 HTTP ' + res.status);
  const arr = await res.json();
  if (!arr.length) return console.log('没搜到结果。');
  console.log(`搜索结果（共显示 ${arr.length} 条，play 时直接粘 URL）：`);
  arr.forEach((s, i) => console.log(`  [${i + 1}] ${s.name} · ${s.country || '?'} · ${s.codec || '?'} · ${s.url_resolved}`));
}

function resolveTarget(target) {
  const st = loadStations();
  const n = Number(target);
  if (Number.isInteger(n) && n >= 1 && n <= st.length) return st[n - 1];
  const byName = st.find((s) => s.name.toLowerCase().includes(String(target).toLowerCase()));
  if (byName) return byName;
  if (/^https?:\/\//i.test(target)) return { name: target, url: target };
  throw new Error(`认不出这个目标：「${target}」。先运行 list 看看编号。`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'list': list(); break;
    case 'search': await search(rest[0] || '', rest[1] || 20); break;
    case 'play': play(resolveTarget(rest.join(' '))); break;
    case 'stop': stop(false); break;
    case 'status': await status(); break;
    case 'volume': await setVolume(Number(rest[0])); break;
    case 'next': {
      const st = loadStations();
      const cur = readState();
      const idx = st.findIndex((s) => s.url === cur?.url);
      play(st[(idx + 1) % st.length]);
      break;
    }
    case 'log': showLog(Number(rest[0]) || 25); break;
    default:
      console.log('用法：list | search <关键词> | play <编号|名称|URL> | stop | status | volume <0-100> | next | log [行数]');
  }
} catch (e) {
  console.error('错误：' + e.message);
  process.exit(1);
}
