// Coral Bay — keyboard and mouse state. One place owns every key binding
// so the HUD, the player and the driver never disagree about a key.
export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, consumed by pollPressed()
  let mouseDX = 0, mouseDY = 0, mouseDown = false;
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
  function onMouseDown(e) { if (e.button === 0) mouseDown = true; }
  function onMouseUp(e) { if (e.button === 0) mouseDown = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === document.body;
  });

  return {
    get locked() { return locked; },
    down(code) { return keys.has(code); },
    axis(neg, pos) { return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0); },
    // True once per physical press; callers poll every frame.
    pollPressed(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    consumeMouse() {
      const dx = mouseDX, dy = mouseDY;
      mouseDX = 0; mouseDY = 0;
      return { dx, dy };
    },
    get mouseDown() { return mouseDown; },
    requestLock() {
      try { document.body.requestPointerLock(); } catch { /* headless: ignore */ }
    },
    // Test / screenshot hook: pretend a key is held.
    fakeDown(code) { keys.add(code); },
    fakeUp(code) { keys.delete(code); },
    fakePress(code) { pressed.add(code); },
  };
}
