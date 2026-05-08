// ============================================================================
// Snave AI — Intro Animation
// ============================================================================
// On first visit, shows "Evans" then reverses the letters to "Snave" with
// a smooth animation. Uses localStorage to only show once.
// ============================================================================

const Intro = (() => {
  const STORAGE_KEY = 'snave-intro-seen';
  const EVANS = ['E', 'v', 'a', 'n', 's'];
  const SNAVE = ['S', 'n', 'a', 'v', 'e'];

  function init() {
    const overlay = document.getElementById('intro-overlay');
    if (!overlay) return;

    // FOR TESTING: Commenting out seen check
    // if (localStorage.getItem(STORAGE_KEY)) {
    //   overlay.remove();
    //   return;
    // }

    // Show the intro
    runAnimation(overlay);
  }

  async function runAnimation(overlay) {
    const letters = overlay.querySelectorAll('.intro-letter');
    const subtitle = document.getElementById('intro-subtitle');

    // Phase 1: Fade in the overlay and show "Evans"
    overlay.classList.add('visible');
    await delay(200);

    // Stagger-reveal each letter of "Evans"
    for (let i = 0; i < letters.length; i++) {
      letters[i].classList.add('revealed');
      await delay(120);
    }

    // Hold "Evans" for a moment
    await delay(800);

    // Phase 2: Reverse animation — letters shuffle to new positions
    // Each letter lifts up, then the whole word re-orders to "Snave"
    
    // First, mark all letters as "lifting" (they float up slightly)
    for (let i = 0; i < letters.length; i++) {
      letters[i].classList.add('lifting');
    }
    await delay(400);

    // Now rearrange: map Evans[i] → Snave positions
    // E(0)→e(4), v(1)→v(3), a(2)→a(2), n(3)→n(1), s(4)→S(0)
    // We'll animate each letter to its new horizontal position
    const positions = [];
    for (let i = 0; i < letters.length; i++) {
      positions.push(letters[i].getBoundingClientRect());
    }

    // Target order: index 4(s→S), 3(n), 2(a), 1(v), 0(E→e)
    const targetMap = [4, 3, 2, 1, 0]; // where each original index ends up

    for (let i = 0; i < letters.length; i++) {
      const targetIdx = targetMap[i];
      const dx = positions[targetIdx].left - positions[i].left;
      letters[i].style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
      letters[i].style.transform = `translateX(${dx}px) translateY(0)`;
    }
    await delay(650);

    // Phase 3: Swap the actual text content to "Snave" and reset transforms
    for (let i = 0; i < letters.length; i++) {
      letters[i].textContent = SNAVE[i];
      letters[i].style.transition = 'none';
      letters[i].style.transform = 'translateX(0) translateY(0)';
      letters[i].classList.remove('lifting');
    }

    // Quick flash effect on the new text
    await delay(50);
    for (let i = 0; i < letters.length; i++) {
      letters[i].classList.add('flash');
    }

    // Show "AI" subtitle
    await delay(300);
    subtitle.classList.add('revealed');

    // Hold the final state
    await delay(1200);

    // Phase 4: Fade out the overlay
    overlay.classList.add('fading');
    await delay(700);
    overlay.remove();

    // Mark as seen
    localStorage.setItem(STORAGE_KEY, 'true');
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
