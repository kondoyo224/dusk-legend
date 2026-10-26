// 키보드/마우스/터치 입력 상태. 프레임 단위 pressed/released 를 제공하고, UI가 입력을 점유(blocked)할 수 있다.
// 터치: 캔버스 탭 = 클릭, 누르고 있기 = 마우스 왼쪽 유지(계속 이동). 가상 조이스틱/버튼은 UI가
//   setVirtualDir(sx, sy) / press(code) / release(code) 로 주입한다 (docs/ARCHITECTURE.md §2).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedSet = new Set();
    this.releasedSet = new Set();
    this.mouse = { x: 0, y: 0, left: false, right: false, inCanvas: false };
    this.clicks = [];      // {x,y,button} 이번 프레임의 캔버스 클릭/탭
    this.mouseDownPressed = false;
    this.wheel = 0;
    this.blocked = false;  // 채팅 입력 중 등 → 게임 조작 무시
    this.virtualDir = null;          // {sx, sy} 화면 기준 -1..1 (가상 조이스틱)
    this.touchMode = matchMedia?.('(pointer: coarse)').matches ?? false; // 마지막 입력이 터치인가
    this.primaryId = null;           // 캔버스를 누르고 있는 포인터

    window.addEventListener('keydown', (e) => {
      if (isTextTarget(e.target)) return;
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
      this.setTouchMode(false);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; this.virtualDir = null; });

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    };
    canvas.style.touchAction = 'none'; // 브라우저 스크롤/확대 제스처 대신 게임 입력
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' && e.pointerId !== this.primaryId) return;
      Object.assign(this.mouse, pos(e));
      this.mouse.inCanvas = e.pointerType === 'mouse';
    });
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.mouse.inCanvas = false; });
    canvas.addEventListener('pointerdown', (e) => {
      const touch = e.pointerType !== 'mouse';
      this.setTouchMode(touch);
      if (touch) {
        if (this.primaryId != null) return; // 두 번째 손가락은 무시(조이스틱은 DOM 위에서 처리)
        this.primaryId = e.pointerId;
        canvas.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }
      const p = pos(e);
      Object.assign(this.mouse, p);
      const button = touch ? 0 : e.button;
      if (button === 0) { this.mouse.left = true; this.mouseDownPressed = true; }
      if (button === 2) this.mouse.right = true;
      this.clicks.push({ ...p, button, touch });
    });
    const up = (e) => {
      if (e.pointerType !== 'mouse') {
        if (e.pointerId !== this.primaryId) return;
        this.primaryId = null;
        this.mouse.left = false;
        this.mouse.inCanvas = false;
        return;
      }
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  setTouchMode(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    window.dispatchEvent(new CustomEvent('input:touchmode', { detail: { touch: on } }));
  }

  // ── 가상 입력 (터치 UI) ──
  setVirtualDir(sx, sy) {
    const m = Math.hypot(sx, sy);
    this.virtualDir = m < 0.3 ? null : { sx: sx / m, sy: sy / m }; // 데드존
  }
  press(code) { if (!this.down.has(code)) this.pressedSet.add(code); this.down.add(code); }
  release(code) { if (this.down.delete(code)) this.releasedSet.add(code); }

  isDown(code) { return !this.blocked && this.down.has(code); }
  pressed(code) { return !this.blocked && this.pressedSet.has(code); }
  released(code) { return this.releasedSet.has(code); }
  anyDown(...codes) { return codes.some((c) => this.isDown(c)); }
  takeClicks() { const c = this.clicks; this.clicks = []; return this.blocked ? [] : c; }
  endFrame() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.clicks.length = 0;
    this.mouseDownPressed = false;
    this.wheel = 0;
  }
}

function isTextTarget(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
