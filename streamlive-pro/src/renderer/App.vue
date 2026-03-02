<template>
  <div class="app-container">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>账号列表</h3>
        <button class="btn btn-primary" style="padding: 5px 10px;">+</button>
      </div>
      <div class="account-list">
        <div
          v-for="acc in accounts"
          :key="acc.id"
          class="account-item"
          :class="{ active: currentAccount?.id === acc.id }"
          @click="selectAccount(acc)"
        >
          <div class="avatar" :style="{ backgroundColor: stringToColor(acc.id) }">
            {{ acc.id.slice(-1) }}
          </div>
          <div class="account-info">
            <h4>{{ acc.name }}</h4>
            <span class="status-dot" :class="`status-${acc.status}`"></span>
            <span style="font-size: 12px; color: var(--text-muted)">
              {{ acc.status === 'streaming' ? '推流中' : (acc.status === 'starting' ? '启动中' : '离线') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content" v-if="currentAccount">
      <!-- Left Column -->
      <div class="main-left">
        <!-- Account Info Card -->
        <div class="card">
          <div class="card-header">
            <h3>当前账号信息</h3>
            <span style="font-size: 12px; color: var(--text-muted)">已选择: <span style="color: var(--primary)">{{ currentAccount.name }}</span></span>
          </div>
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">推流状态</div>
              <div class="info-value" :class="{ streaming: currentAccount.status === 'streaming' }">
                {{ currentAccount.status === 'streaming' ? '直播中' : (currentAccount.status === 'starting' ? '准备中' : '未开播') }}
              </div>
            </div>
            <div class="info-box">
              <div class="info-label">推流方案</div>
              <div class="info-value" style="color: var(--primary)">{{ getStreamTypeName(currentAccount.streamType) }}</div>
            </div>
            <div class="info-box">
              <div class="info-label">运行时长</div>
              <div class="info-value" style="color: var(--success)">{{ formatDuration(currentAccount.duration) }}</div>
            </div>
          </div>
        </div>

        <!-- Stream Settings Card -->
        <div class="card">
          <div class="card-header">
            <h3>推流设置 <span style="font-size: 12px; background: #f0f4ff; color: var(--primary); padding: 2px 8px; border-radius: 10px; margin-left: 10px;">{{ getStreamTypeName(selectedStreamType) }}</span></h3>
            <span v-if="currentAccount.status === 'streaming'" style="color: white; background-color: #ef233c; padding: 5px 10px; border-radius: 15px; font-size: 12px;">推流中</span>
          </div>
          <div class="input-group">
            <label>推流服务器 (RTMP地址)</label>
            <input type="text" v-model="rtmpServer" placeholder="例如: rtmp://live-push.example.com/live/">
          </div>
          <div class="input-group">
            <label>串流密钥</label>
            <input type="password" v-model="streamKey" placeholder="输入密钥">
          </div>
        </div>

        <!-- Stream Scheme Card -->
        <div class="card">
          <div class="card-header">
            <h3>推流方案</h3>
          </div>
          <div class="scheme-selector">
            <button class="scheme-btn" :class="{ active: selectedStreamType === 'rtmp' }" @click="selectedStreamType = 'rtmp'">
              <div>🚀 RTMP原生</div>
            </button>
            <button class="scheme-btn" :class="{ active: selectedStreamType === 'ffmpeg' }" @click="selectedStreamType = 'ffmpeg'">
              <div>🎦 FFmpeg推流</div>
            </button>
            <button class="scheme-btn" :class="{ active: selectedStreamType === 'webrtc' }" @click="selectedStreamType = 'webrtc'">
              <div>🌐 WebRTC推流</div>
            </button>
          </div>

          <div style="margin-top: 20px;">
            <button
              v-if="currentAccount.status === 'offline'"
              class="btn btn-primary"
              style="width: 100%; font-size: 16px; padding: 15px;"
              @click="startStream"
            >
              ▶ 开始推流
            </button>
            <button
              v-else
              class="btn btn-danger"
              @click="stopStream"
            >
              ⏹ 停止推流
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="main-right">
        <!-- Quick Settings -->
        <div class="card">
          <div class="card-header">
            <h3>⚙️ 快速设置</h3>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <span>定时关播</span>
            <label class="toggle-switch">
              <input type="checkbox" v-model="timerEnabled">
              <span class="slider"></span>
            </label>
          </div>

          <div v-if="timerEnabled" style="display: flex; gap: 10px; margin-bottom: 20px; align-items: center;">
            <span style="font-size: 14px;">定时时长:</span>
            <input type="number" v-model.number="timerHours" min="0" style="width: 50px; padding: 5px; border: 1px solid var(--border); border-radius: 4px;"> 时
            <input type="number" v-model.number="timerMinutes" min="0" max="59" style="width: 50px; padding: 5px; border: 1px solid var(--border); border-radius: 4px;"> 分
          </div>
          <div v-if="timerEnabled && currentAccount?.status === 'streaming'" style="margin-bottom: 20px; color: var(--danger); font-size: 14px; text-align: center;">
             距离关播: {{ formatRemainingTime(remainingSeconds) }}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <span>推流视频资源</span>
          </div>

          <div
            @click="selectMediaFile"
            style="border: 2px dashed #a0c4ff; border-radius: 8px; padding: 30px; text-align: center; color: var(--primary); cursor: pointer; background: #f8faff; word-break: break-all;"
          >
            <span v-if="selectedFilePath">{{ selectedFilePath }}</span>
            <span v-else>
              点击选择本地视频<br>
              <span style="font-size: 12px; color: var(--text-muted);">MP4 / FLV / MKV</span>
            </span>
          </div>

        </div>
      </div>
    </div>
    <div v-else class="main-content" style="display: flex; justify-content: center; align-items: center;">
       <h2 style="color: var(--text-muted)">请在左侧选择一个账号</h2>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

const { ipcRenderer } = window.require('electron');

interface IAccountInfo {
  id: string;
  name: string;
  status: 'offline' | 'starting' | 'streaming' | 'error';
  duration: number;
  streamType: string;
}

const accounts = ref<IAccountInfo[]>([]);
const currentAccount = ref<IAccountInfo | null>(null);
const selectedStreamType = ref('rtmp');
const timerEnabled = ref(true);

// 资源与推流配置
const selectedFilePath = ref('');
const rtmpServer = ref('rtmp://localhost/live/'); // 默认测试地址
const streamKey = ref('test'); // 默认测试密钥

// 定时关播
const timerHours = ref(0);
const timerMinutes = ref(30);
let timerInterval: any = null;
const remainingSeconds = ref(0);

const fetchAccounts = async () => {
  accounts.value = await ipcRenderer.invoke('get-accounts');
  if (accounts.value.length > 0 && !currentAccount.value) {
    selectAccount(accounts.value[0]);
  } else if (currentAccount.value) {
      // update current account ref
      const updated = accounts.value.find(a => a.id === currentAccount.value?.id);
      if(updated) currentAccount.value = updated;
  }
};

const selectAccount = (acc: IAccountInfo) => {
  currentAccount.value = acc;
  selectedStreamType.value = acc.streamType || 'rtmp';
};

const selectMediaFile = async () => {
  const filePath = await ipcRenderer.invoke('select-file');
  if (filePath) {
    selectedFilePath.value = filePath;
  }
};

const startStream = async () => {
  if (!currentAccount.value) return;

  if (selectedStreamType.value === 'ffmpeg' && !selectedFilePath.value) {
      alert('使用 FFmpeg 推流前，请先在右侧选择要推流的本地视频文件！');
      return;
  }
  if (!rtmpServer.value || !streamKey.value) {
      alert('请填写推流服务器地址和密钥！');
      return;
  }

  const streamConfig = {
      server: rtmpServer.value,
      key: streamKey.value,
      filePath: selectedFilePath.value
  };

  const res = await ipcRenderer.invoke('start-account', currentAccount.value.id, selectedStreamType.value, streamConfig);
  if (res.success) {
      currentAccount.value.status = 'starting';
      currentAccount.value.streamType = selectedStreamType.value;

      // 启动定时器
      if (timerEnabled.value && (timerHours.value > 0 || timerMinutes.value > 0)) {
          startTimer();
      }
  } else {
      alert(`启动失败: ${res.error}`);
  }
};

const stopStream = async () => {
  if (!currentAccount.value) return;
  const res = await ipcRenderer.invoke('stop-account', currentAccount.value.id);
  if (res.success) {
      clearTimer();
  } else {
      alert(`停止失败: ${res.error}`);
  }
};

const startTimer = () => {
    clearTimer();
    remainingSeconds.value = timerHours.value * 3600 + timerMinutes.value * 60;
    timerInterval = setInterval(() => {
        if (remainingSeconds.value <= 0) {
            clearTimer();
            stopStream(); // 定时到期，自动停止推流
            alert(`【${currentAccount.value?.name}】定时关播已触发。`);
        } else {
            remainingSeconds.value--;
        }
    }, 1000);
};

const clearTimer = () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
};

watch(currentAccount, (newAcc, oldAcc) => {
    // 切换账号边界处理
});

onMounted(() => {
  fetchAccounts();

  // Listen for real-time status updates from the main process
  ipcRenderer.on('account-status-changed', (event: any, { accountId, status }: any) => {
      console.log(`Received status update for ${accountId}: ${status}`);
      const acc = accounts.value.find(a => a.id === accountId);
      if (acc) {
          acc.status = status;
          if (currentAccount.value && currentAccount.value.id === accountId) {
             currentAccount.value.status = status;
          }
      }
  });
});

onUnmounted(() => {
    ipcRenderer.removeAllListeners('account-status-changed');
    clearTimer();
});

// Utils
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF)
    .toString(16)
    .toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const getStreamTypeName = (type: string) => {
    switch(type) {
        case 'rtmp': return 'RTMP原生';
        case 'ffmpeg': return 'FFmpeg推流';
        case 'webrtc': return 'WebRTC推流';
        default: return type;
    }
}

const formatDuration = (seconds: number) => {
    if(!seconds) return '0分钟';
    const m = Math.floor(seconds / 60);
    return `${m}分钟`;
}

const formatRemainingTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
</script>
