import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { EventEmitter } from 'events';
import { AIEngine } from './AIEngine';

export class BrowserInstance extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isHeadless: boolean = false;
  private aiEngine: AIEngine;
  private chatSimulationInterval: NodeJS.Timeout | null = null;

  // 网络嗅探状态
  private interceptedStreamConfig: { server: string, key: string } | null = null;
  private sniffResolve: ((value: any) => void) | null = null;

  constructor(headless: boolean = false) {
    super();
    this.isHeadless = headless;
    this.aiEngine = new AIEngine();
    this.setupAIEngine();
  }

  private setupAIEngine() {
    this.aiEngine.on('ai-log', (log) => {
      this.emit('ai-log', log);
    });

    this.aiEngine.on('ai-reply-generated', async (reply) => {
      // 在真实的直播中，这会通过 Playwright 去寻找聊天输入框
      console.log(`[BrowserInstance] Typing AI reply: "${reply}"`);
      await this.sendChatToLiveStream(reply);
    });
  }

  async start(): Promise<void> {
    console.log(`[Browser] Starting (headless: ${this.isHeadless})`);
    this.browser = await chromium.launch({
        headless: this.isHeadless,
        args: [
            '--disable-blink-features=AutomationControlled', // 核心屏蔽自动化特征
            '--disable-infobars',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--ignore-certificate-errors',
        ]
    });

    // 配置类似真人的 Context，并注入自定义 User-Agent
    this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai'
    });

    // 深度注入反风控脚本 (Stealth) 到每一个新建的 Page
    await this.context.addInitScript(() => {
        // 1. 抹除 navigator.webdriver (绝大多数检测的基础)
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // 2. 伪造 window.chrome 对象
        (window as any).chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };

        // 3. 抹除 Playwright 特有的全局变量特征 (如果不慎泄露)
        delete (window as any).__playwright;
        delete (window as any).__pw_manual;
        delete (window as any).__PW_outOfContext;

        // 4. 修改 Permissions API 的默认行为 (Headless 默认是 denied, 真人通常是 prompt)
        const originalQuery = window.navigator.permissions.query;
        (window.navigator.permissions as any).query = (parameters: any) => {
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: Notification.permission } as PermissionStatus);
            }
            return originalQuery(parameters);
        };

        // 5. 伪装 WebGL 渲染器指纹 (绕过高级硬件指纹检测)
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, [parameter]);
        };
    });

    this.page = await this.context.newPage();
    this.setupNetworkSniffer();
  }

  private setupNetworkSniffer() {
    if (!this.page) return;

    this.page.on('response', async (response) => {
        try {
            const url = response.url();
            // 忽略非 API 请求，加快处理速度
            if (!url.includes('/api/') && !url.includes('stream') && !url.includes('live')) return;

            const resourceType = response.request().resourceType();
            if (resourceType === 'fetch' || resourceType === 'xhr') {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const text = await response.text();

                    // 智能嗅探：不管具体平台，使用正则寻找推流协议特征
                    // 特征 1: rtmp://... 形式的 URL
                    // 特征 2: stream_url, push_url 等常见的 JSON 键
                    if (text.includes('rtmp://') || text.includes('stream_url')) {
                        console.log(`[NetworkSniffer] Suspicious JSON detected in ${url}`);
                        const parsed = JSON.parse(text);
                        this.extractStreamConfig(parsed);
                    }
                }
            }
        } catch (e) {
            // 忽略读取 response.text() 失败的错（如被 abort）
        }
    });
  }

  private extractStreamConfig(data: any) {
      if (this.interceptedStreamConfig) return; // 已经抓到了就跳过

      // 递归搜索 JSON 树，寻找类似 rtmp 链接的字段
      const searchJSON = (obj: any): string | null => {
          if (!obj) return null;
          if (typeof obj === 'string') {
              if (obj.startsWith('rtmp://')) return obj;
              return null;
          }
          if (typeof obj === 'object') {
              for (const key in obj) {
                  const result = searchJSON(obj[key]);
                  if (result) return result;
              }
          }
          return null;
      };

      const fullUrl = searchJSON(data);
      if (fullUrl) {
          console.log(`[NetworkSniffer] 🎉 Successfully extracted RTMP URL: ${fullUrl}`);

          // 简单的切割逻辑：以最后一个 '/' 为界，前面是 server，后面是 key
          // 实际平台可能需要更复杂的正则，比如 rtmp://domain/app/stream_name?token=...
          const lastSlashIndex = fullUrl.lastIndexOf('/');
          const server = fullUrl.substring(0, lastSlashIndex + 1);
          const key = fullUrl.substring(lastSlashIndex + 1);

          this.interceptedStreamConfig = { server, key };

          if (this.sniffResolve) {
              this.sniffResolve(this.interceptedStreamConfig);
              this.sniffResolve = null;
          }
      }
  }

  async loginDouyin(): Promise<boolean> {
    console.log(`[Browser] Simulating Douyin login...`);
    if (!this.page) return false;

    // 模拟访问和登录流程 (实际需替换为真实逻辑，可能使用保存的 Cookie)
    await this.page.goto('https://creator.douyin.com/');
    await this.page.waitForTimeout(2000); // 假装等待加载

    // 启动模拟弹幕抓取
    this.startChatSimulation();

    return true;
  }

  private startChatSimulation() {
    // 模拟监听网页 WebSocket 接收到的真实弹幕
    const sampleChats = [
        { user: '大哥666', msg: '主播好，这个怎么卖？' },
        { user: '神秘人', msg: '测试一下弹幕' },
        { user: '榜一大哥', msg: '多少钱能带走？' },
        { user: '小迷妹', msg: '晚上好呀！' }
    ];

    this.chatSimulationInterval = setInterval(() => {
        const randomChat = sampleChats[Math.floor(Math.random() * sampleChats.length)];
        this.aiEngine.processChat(randomChat.user, randomChat.msg);
    }, 15000); // 每 15 秒模拟收到一条弹幕
  }

  private async sendChatToLiveStream(text: string) {
    if (!this.page) return;

    try {
        // 在实际应用中，你需要替换成直播间真实的输入框 Selector
        // const inputSelector = 'textarea.chat-input';
        // const sendBtnSelector = 'button.send-btn';

        // await this.page.locator(inputSelector).fill(text);
        // await this.page.waitForTimeout(500); // 模拟人类打字停顿
        // await this.page.locator(sendBtnSelector).click();

        // 这里仅作控制台演示
        console.log(`[BrowserInstance] Playwright simulated typing text into DOM...`);
    } catch (e) {
        console.error('[BrowserInstance] Failed to send chat to DOM:', e);
    }
  }

  async checkLoginStatus(): Promise<boolean> {
    console.log(`[Browser] Checking login status...`);
    // 模拟检查
    return true;
  }

  async getStreamCode(): Promise<any> {
    console.log(`[Browser] Waiting for stream code via network sniffing...`);

    // 如果已经抓到了，直接返回
    if (this.interceptedStreamConfig) {
        return this.interceptedStreamConfig;
    }

    // 否则挂起 Promise 等待抓包回调
    return new Promise((resolve, reject) => {
        this.sniffResolve = resolve;

        // 设置一个超时机制，防止一直等不到
        setTimeout(() => {
            if (this.sniffResolve) {
                console.warn(`[NetworkSniffer] Timeout waiting for stream code. Returning fallback test code.`);
                this.sniffResolve = null;
                resolve({
                    server: 'rtmp://live-push.example.com/live/',
                    key: 'timeout_fallback_key',
                });
            }
        }, 30000); // 30 秒超时
    });
  }

  async switchToHeadlessMode(): Promise<void> {
    console.log(`[Browser] Switching to headless mode...`);
    this.isHeadless = true;
    // 重新启动浏览器或调整配置
  }

  async saveDouyinCookies(): Promise<void> {
    console.log(`[Browser] Saving Douyin cookies...`);
    if(this.context) {
        const cookies = await this.context.cookies();
        // 保存逻辑 (e.g. electron-store 或文件)
    }
  }

  async stop(): Promise<void> {
    console.log(`[Browser] Stopping browser...`);
    if (this.chatSimulationInterval) {
        clearInterval(this.chatSimulationInterval);
    }
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}
