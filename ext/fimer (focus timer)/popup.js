document.addEventListener('DOMContentLoaded', function() {
  const timerDisplay = document.getElementById('timer');
  const durationInput = document.getElementById('durationInput');
  const warningInput = document.getElementById('warningInput');
  const closingInput = document.getElementById('closingInput');
  const startButton = document.getElementById('startTimer');
  const stopButton = document.getElementById('stopTimer');

  // Check existing timer state on popup open
  chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
    if (response.isRunning) {
      startButton.style.display = 'none';
      stopButton.style.display = 'block';
    }
  });

  startButton.addEventListener('click', () => {
    const duration = parseFloat(durationInput.value);
    const warning = parseFloat(warningInput.value) || 2;
    const closing = parseFloat(closingInput.value) || 1;

    if (duration) {
      chrome.runtime.sendMessage({
        action: "startTimer",
        duration: duration,
        warningThreshold: warning,
        closingThreshold: closing
      });

      startButton.style.display = 'none';
      stopButton.style.display = 'block';
    }
  });

  stopButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "stopTimer" });

    startButton.style.display = 'block';
    stopButton.style.display = 'none';
  });
});
