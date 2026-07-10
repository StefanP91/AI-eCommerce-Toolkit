export function scrollToGuidedSetup() {
  const el = document.getElementById('guided-api-setup');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
