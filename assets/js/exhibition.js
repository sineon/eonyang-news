(() => {
  const button = document.getElementById('save-exhibition');
  const status = document.getElementById('exhibition-status');
  if (!button || !status) return;
  if (!('serviceWorker' in navigator)) {
    button.disabled = true;
    status.textContent = '이 브라우저는 오프라인 저장을 지원하지 않습니다.';
    return;
  }
  const workerPath = new URL('./sw.js', document.baseURI);
  const install = navigator.serviceWorker.register(workerPath);
  install.catch(() => {
    status.textContent = '오프라인 저장 기능을 시작하지 못했습니다. 연결 또는 브라우저 설정을 확인해 주세요.';
  });
  function showOffline() {
    if (!navigator.onLine) status.textContent = '오프라인입니다. 저장된 소식지를 보는 중이며 외부 원문은 연결이 필요합니다.';
  }
  window.addEventListener('offline', showOffline);
  window.addEventListener('online', () => {
    status.textContent = '인터넷에 다시 연결됐습니다. 필요하면 최신 내용을 저장하세요.';
  });
  showOffline();
  button.addEventListener('click', async () => {
    if (!navigator.onLine) return showOffline();
    button.disabled = true;
    status.textContent = '전시용으로 소식지와 사진을 저장 중입니다…';
    let timer;
    let channel;
    try {
      const response = new Promise(async (resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), 15000);
        try {
          await install;
          const registration = await navigator.serviceWorker.ready;
          channel = new MessageChannel();
          channel.port1.onmessage = event => resolve(event.data);
          registration.active.postMessage('SAVE_EXHIBITION', [channel.port2]);
        } catch (error) { reject(error); }
      });
      const result = await response;
      if (!result.ok) throw new Error('cache');
      status.textContent = `오프라인 저장 완료 · 본문과 5개 탭 · 사진 ${result.photos}/${result.total}장 저장`;
    } catch {
      status.textContent = '오프라인 저장을 완료하지 못했습니다. 인터넷이 안정적인 곳에서 다시 눌러 주세요.';
    } finally {
      clearTimeout(timer);
      channel?.port1.close();
      button.disabled = false;
    }
  });
})();
