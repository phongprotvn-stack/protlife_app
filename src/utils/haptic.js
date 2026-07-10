export function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(50);
          break;
        case 'medium':
          navigator.vibrate(100);
          break;
        case 'heavy':
          navigator.vibrate(200);
          break;
        case 'success':
          navigator.vibrate([50, 50, 100]);
          break;
        case 'error':
          navigator.vibrate([100, 50, 100, 50, 100]);
          break;
        default:
          navigator.vibrate(50);
      }
    } catch (e) {
      // Ignore if not supported
    }
  }
}
