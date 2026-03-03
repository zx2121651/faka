# StreamLive Pro

StreamLive Pro 是一款基于 Electron、Vue 3、TypeScript、Playwright 和 FFmpeg 构建的多账号自动化直播与 AI 智能场控桌面应用软件。

该项目采用了**多进程架构**，通过独立 Worker 进程安全地隔离多账号登录信息，使用自动化浏览器无头（或有头）模式接管直播间交互，并通过本地或远端大模型（如 DeepSeek/OpenAI）为直播间提供智能场控（自动欢迎、自动回复、导购）功能，同时结合 FFmpeg 提供灵活的视频推流和动态水印防护。

---

## 🏗 技术架构

应用由三大核心进程集群组成：

### 1. Main 进程 (主控中心)
作为 Electron 的主进程，负责应用的生命周期、窗口管理、系统级接口和子进程的调度。
- **AccountCoordinator**: 账号协调器。负责加载和持久化保存所有直播账号信息 (`accounts.json`)，并为每个开启直播的账号孵化（fork）一个独立的 Worker 进程。
- **SystemMonitor**: 性能监控器。通过直接读取 `/proc/net/dev`、CPU 和内存信息，向前端实时推送系统整体负载数据。
- **ResourceManager**: 资源管理器。负责视频流媒体本地文件选取以及上传资源的统筹。

### 2. Renderer 进程 (前端 UI)
基于 **Vue 3** 组合式 API (Composition API) 编写的直观桌面端控制面板，采用 Vite 进行构建。
- **动态控制台**: 实时显示各账号的推流状态、AI 互动日志和系统监控面板。
- **配置面板**: 提供每个账号独立的 RTMP 推流服务器配置、FFmpeg 视频源配置以及 AI 系统提示词（Prompt）与模型 Provider 配置。
- **二维码扫码桥接**: 通过 IPC 接收主进程转发过来的实时登录二维码并弹窗供用户扫码。

### 3. Worker 进程 (账号沙盒)
由主进程 fork 出来的 Node.js 子进程，每个 Worker 对应一个直播账号，实现物理级别的内存隔离和并发安全。
- **BrowserInstance (Playwright 注入)**: 通过 Playwright 启动自动化浏览器实例。内置深度反检测机制（Stealth），并拦截网络请求（XHR）动态抓取真实的推流密钥（Stream Key）；监听 DOM 变化以实现实时抓取直播间弹幕（MutationObserver），并通过模拟输入实现 AI 自动回复。
- **AIEngine**: 智能场控大脑。根据用户的设定，通过原生 `fetch` 并发请求大型语言模型（DeepSeek / OpenAI）的 Chat Completion API，生成与观众的自然对话。
- **StreamingService**: FFmpeg 推流服务。通过 `child_process.spawn` 拉起 FFmpeg 将本地媒体推流到目标 RTMP 服务器。内建指数退避断线重连机制，以及动态 `drawtext` 视频滤镜用于生成随机防盗播水印。

---

## 🌟 核心特性

- **多账号无缝隔离**: 每个账号的浏览器缓存（Cookies、LocalStorage）分别持久化，不会串号；使用二维码免密安全登录，登录状态跨进程长效保持。
- **智能 Playwright 场控**: 动态嗅探网页端 XHR 包截获推流地址；挂载原生 Observer 监听弹幕并自动触发浏览器事件输入 AI 回复。
- **抗封禁与防盗播**: 提供基于 FFmpeg 滤镜的动态水印机制，防爬虫窃取流媒体；注入多种 WebGL/WebDriver 掩码脚本（Stealth）防浏览器被平台识别。
- **定时与自动化**: 支持自定义定时关播功能。系统可自动在断流时进行重连。

---

## 🛠 本地开发与构建指南

### 环境要求

- Node.js >= 18.x
- 本地环境需要预先安装好可用的 `ffmpeg`
- Linux/Mac/Windows 均可

### 快速启动

1. **安装依赖**：
   ```sh
   npm install
   ```
2. **安装 Playwright 浏览器引擎**：
   ```sh
   npx playwright install
   ```
3. **启动开发模式**：
   ```sh
   npm run start:dev
   ```
   > 启动命令会同时拉起 Vite 开发服务器和 Electron 的实时编译监视器。(实际上是执行 `package.json` 中的 dev 指令)

### 打包构建

该项目使用 `electron-builder` 进行打包：
```sh
npm run build     # 编译前端和后端代码到 dist/
npm run package   # 执行 electron-builder 生成系统对应平台的安装包
```

### 端到端 (E2E) 测试

本项目包含使用 Playwright 测试 Electron 桌面端的端到端集成测试，验证账号持久化与 IPC 弹窗 UI 等核心功能。

**运行测试 (无头模式，针对 CI 环境)：**
```sh
xvfb-run --auto-servernum npx playwright test
```

---

## 📄 架构图映射参考

虽然仓库中未直接附带图形化的架构图文件，但以上文本架构就是标准架构图的完美映射。您可以将 **主进程** 视作中枢总线，**Renderer 进程** 视作左侧用户态面板，**Worker 进程（BrowserInstance, AIEngine, FFmpeg）** 视作右侧的账号流转中心与执行节点。
