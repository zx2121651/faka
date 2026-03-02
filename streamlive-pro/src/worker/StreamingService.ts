import { ChildProcess, spawn } from 'child_process';
import { IStreamConfig } from '../shared/types';

export class StreamingService {
  private ffmpegProcess: ChildProcess | null = null;
  private isStreaming: boolean = false;

  constructor() {}

  async start(streamCode: IStreamConfig | null, streamType: string): Promise<void> {
    if (this.isStreaming) return;

    console.log(`[StreamingService] Starting stream (Type: ${streamType})...`);

    if (streamType === 'ffmpeg' || streamType === 'rtmp') {
      await this.startFFmpegProcess(streamCode);
    } else if (streamType === 'webrtc') {
       // WebRTC 推流逻辑 (通常通过浏览器端进行)
       console.log('[StreamingService] WebRTC selected. Using Browser context to push.');
    }

    this.isStreaming = true;
  }

  private async startFFmpegProcess(config: IStreamConfig | null): Promise<void> {
      console.log(`[StreamingService] Preparing real FFmpeg command...`);

      if (!config || !config.server || !config.key) {
          throw new Error('Missing RTMP server or key in stream config.');
      }

      let inputPath = config.filePath;
      if (!inputPath) {
          // Fallback dummy file for testing without user selection
          inputPath = 'dummy_input.mp4';
          console.warn('[StreamingService] No input file selected, using fallback.');
      }

      const rtmpUrl = config.server.endsWith('/') ? `${config.server}${config.key}` : `${config.server}/${config.key}`;

      // 真实的 FFmpeg 参数构建
      const args = [
          '-re', // Read input at native frame rate (important for live streaming)
          '-i', inputPath, // 真实用户选择的文件
          '-c:v', 'libx264', // H.264 video codec
          '-preset', 'veryfast', // Encoding speed/compression tradeoff
          '-maxrate', '3000k', // Max video bitrate (example)
          '-bufsize', '6000k',
          '-pix_fmt', 'yuv420p',
          '-g', '50', // GOP size (keyframe interval)
          '-c:a', 'aac', // AAC audio codec
          '-b:a', '128k', // Audio bitrate
          '-ar', '44100', // Audio sample rate
          '-f', 'flv', // Output format must be FLV for RTMP
          rtmpUrl
      ];

      console.log(`[StreamingService] Executing: ffmpeg ${args.join(' ')}`);

      try {
          // 真实执行 ffmpeg (前提是系统环境变量中已有 ffmpeg)
          this.ffmpegProcess = spawn('ffmpeg', args);
          this.handleFFmpegOutput();
          console.log(`[StreamingService] Real FFmpeg process started. PID: ${this.ffmpegProcess.pid}`);
      } catch (err: any) {
          console.error(`[StreamingService] Failed to start FFmpeg:`, err);
          this.isStreaming = false;
          throw new Error('Failed to start FFmpeg process. Is ffmpeg installed and in PATH?');
      }
  }

  private handleFFmpegOutput(): void {
      if (!this.ffmpegProcess || !this.ffmpegProcess.stderr) return;

      this.ffmpegProcess.stderr.on('data', (data) => {
          // 解析输出，监控错误，更新状态
          const output = data.toString();
          if (output.includes('error')) {
               console.error('[StreamingService] FFmpeg error detected.');
          }
      });

      // 捕获标准输出
      this.ffmpegProcess.stdout?.on('data', (data) => {
          // console.log(`[FFmpeg INFO] ${data.toString()}`);
      });

      this.ffmpegProcess.on('close', (code) => {
          console.log(`[StreamingService] FFmpeg exited with code ${code}`);
          this.isStreaming = false;
      });
  }

  async switchResource(newResourceId: string): Promise<void> {
      console.log(`[StreamingService] Switching resource to: ${newResourceId}`);
      // 调整推流规则
      this.adjustTrafficRules(newResourceId);
  }

  private adjustTrafficRules(rules: any): void {
      console.log(`[StreamingService] Adjusting traffic rules...`);
  }

  async stop(): Promise<void> {
      console.log(`[StreamingService] Stopping stream...`);
      if (this.ffmpegProcess) {
          this.ffmpegProcess.kill('SIGKILL');
          this.ffmpegProcess = null;
      }
      this.isStreaming = false;
  }
}
