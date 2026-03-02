import { EventEmitter } from 'events';

export interface IAILog {
    type: 'user' | 'ai';
    username: string;
    text: string;
    timestamp: number;
}

import { IAISettings } from '../shared/types';

export interface ILLMProvider {
    generateReply(chatMessage: string, username: string): Promise<string>;
}

export class RealLLMProvider implements ILLMProvider {
    private apiUrl: string;
    private modelName: string;

    constructor(private config: IAISettings) {
        if (config.provider === 'deepseek') {
            this.apiUrl = 'https://api.deepseek.com/chat/completions';
            this.modelName = 'deepseek-chat';
        } else {
            this.apiUrl = 'https://api.openai.com/v1/chat/completions';
            this.modelName = 'gpt-3.5-turbo';
        }
    }

    async generateReply(chatMessage: string, username: string): Promise<string> {
        try {
            const messages = [
                { role: 'system', content: this.config.systemPrompt },
                { role: 'user', content: `[观众 @${username} 说]: ${chatMessage}\n请根据弹幕给出回复。直接输出回复内容，不要包含任何前缀、引号或解释。` }
            ];

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: messages,
                    max_tokens: 50,
                    temperature: 0.7,
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API Error ${response.status}: ${errorData}`);
            }

            const data = await response.json();
            const reply = data.choices[0].message.content.trim();
            return reply;
        } catch (error) {
            console.error('[RealLLMProvider] API request failed:', error);
            // Fallback mock if requested API fails (for demo/resilience purposes)
            return `@${username} 主播正在忙，请稍后哦~`;
        }
    }
}

// 保留 Mock 以备无网络测试或不启用 AI 时使用
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

    constructor(aiSettings?: IAISettings) {
        super();
        if (aiSettings && aiSettings.enabled && aiSettings.apiKey) {
            console.log(`[AIEngine] Using Real LLM Provider: ${aiSettings.provider}`);
            this.provider = new RealLLMProvider(aiSettings);
        } else {
            console.warn(`[AIEngine] AI Settings missing or disabled. Using Mock Provider.`);
            this.provider = new MockLLMProvider();
        }
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