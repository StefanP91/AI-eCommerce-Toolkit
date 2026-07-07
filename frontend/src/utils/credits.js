export function notifyCreditsUpdated() {
  window.dispatchEvent(new Event('credits-updated'));
}
