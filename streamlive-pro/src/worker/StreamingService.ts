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
      console.log(`[StreamingService] Preparing FFmpeg command...`);

      // 模拟构建 FFmpeg 参数 (buildFfmpegArgs)
      const args = [
          '-re',
          '-i', 'dummy_input.mp4', // 需要替换为真实资源
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-c:a', 'aac',
          '-f', 'flv',
          config ? `${config.server}${config.key}` : 'rtmp://localhost/live/test'
      ];

      // console.log(`[StreamingService] Executing: ffmpeg ${args.join(' ')}`);

      // 模拟进程启动，而不是真的跑 ffmpeg (避免无环境报错)
      // this.ffmpegProcess = spawn('ffmpeg', args);
      // this.handleFFmpegOutput();

      console.log(`[StreamingService] Dummy FFmpeg process started.`);
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
