// Send transitions, not one database-backed hub invocation per keystroke.
export function createTypingNotifier(notify, idleMs = 1200) {
  let active = false;
  let timer;
  const stop = () => {
    clearTimeout(timer);
    if (!active) return;
    active = false;
    notify(false);
  };
  return {
    update(value) {
      if (!value.trim()) {
        stop();
        return;
      }
      if (!active) {
        active = true;
        notify(true);
      }
      clearTimeout(timer);
      timer = setTimeout(stop, idleMs);
    },
    stop,
  };
}
