import { EventEmitter } from 'events';

export interface IAILog {
    type: 'user' | 'ai';
    username: string;
    text: string;
    timestamp: number;
}

export interface ILLMProvider {
    generateReply(chatMessage: string, username: string): Promise<string>;
}

// 模拟的 AI 引擎
export class MockLLMProvider implements ILLMProvider {
    async generateReply(chatMessage: string, username: string): Promise<string> {
        // 模拟 AI 处理延迟
        await new Promise(resolve => setTimeout(resolve, 800));

        const lowerMsg = chatMessage.toLowerCase();
        if (lowerMsg.includes('你好') || lowerMsg.includes('hello')) {
            return `你好呀，@${username}！欢迎来到直播间！`;
        } else if (lowerMsg.includes('多少钱')) {
            return `@${username} 目前优惠价只要 99 哦，点击下方小黄车！`;
        } else if (lowerMsg.includes('怎么买')) {
            return `@${username} 左下角小黄车直接拍，现货秒发！`;
        } else {
            return `@${username} 感谢支持！觉得不错的话点个关注吧~`;
        }
    }
}

export class AIEngine extends EventEmitter {
    private provider: ILLMProvider;
    private processingQueue: Array<{username: string, text: string}> = [];
    private isProcessing: boolean = false;

    constructor() {
        super();
        this.provider = new MockLLMProvider();
    }

    public async processChat(username: string, text: string) {
        // 记录用户弹幕
        this.emit('ai-log', {
            type: 'user',
            username,
            text,
            timestamp: Date.now()
        } as IAILog);

        this.processingQueue.push({ username, text });
        this.processNext();
    }

    private async processNext() {
        if (this.isProcessing || this.processingQueue.length === 0) return;

        this.isProcessing = true;
        const chat = this.processingQueue.shift();

        if (chat) {
            try {
                const reply = await this.provider.generateReply(chat.text, chat.username);

                // 记录 AI 回复并向上层抛出事件 (以便执行键盘打字发送)
                this.emit('ai-reply-generated', reply);

                this.emit('ai-log', {
                    type: 'ai',
                    username: 'AI 场控',
                    text: reply,
                    timestamp: Date.now()
                } as IAILog);

            } catch (error) {
                console.error('[AIEngine] Failed to generate reply:', error);
            }
        }

        this.isProcessing = false;

        // 继续处理队列中剩余的消息
        if (this.processingQueue.length > 0) {
            this.processNext();
        }
    }
}