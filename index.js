// FAIFAH Affection Bar - SillyTavern extension
// Bot ends each reply with [LIKE:+N]. This extension hides the tag, shows a chip
// under the message, and keeps a running total in a bar above the chat.
(() => {
  const MODULE = 'faifah_affection';
  const PROMPT_KEY = 'faifah_affection_prompt';
  const TAG_RE = /\[\s*LIKE\s*:\s*([+-]?\d+)\s*\]/gi;

  const DEFAULTS = {
    enabled: true,
    name: 'ไฟฟ้า',
    start: 50,
    max: 1000,
    minDelta: -10,
    maxDelta: 15,
  };

  // [threshold at max=1000, label, icon]
  const LEVELS = [
    [0, 'คู่กัด', '⚔️'],
    [150, 'แอบชอบ', '💗'],
    [300, 'ลองคุย', '💭'],
    [500, 'คนคุย', '💞'],
    [700, 'แฟน', '❤️'],
    [850, 'คนรัก', '💘'],
    [950, 'คู่ชีวิต', '💍'],
    [1000, 'คู่แท้', '✨'],
  ];

  const ctx = () => SillyTavern.getContext();

  function settings() {
    const c = ctx();
    if (!c.extensionSettings[MODULE]) c.extensionSettings[MODULE] = {};
    const s = c.extensionSettings[MODULE];
    for (const k of Object.keys(DEFAULTS)) if (s[k] === undefined) s[k] = DEFAULTS[k];
    return s;
  }
  const save = () => ctx().saveSettingsDebounced();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function levelFor(value, max) {
    const scaled = (value / max) * 1000;
    let lv = LEVELS[0];
    for (const l of LEVELS) if (scaled >= l[0]) lv = l;
    return lv;
  }

  function lastDelta(text) {
    if (!text) return null;
    let m, last = null;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(text)) !== null) last = parseInt(m[1], 10);
    return last;
  }

  // Walk the current chat and compute the running total and each message's applied delta.
  function compute() {
    const s = settings();
    const chat = ctx().chat || [];
    let value = clamp(Number(s.start) || 0, 0, s.max);
    const applied = {};
    chat.forEach((msg, i) => {
      if (!msg || msg.is_user || msg.is_system) return;
      const d = lastDelta(msg.mes);
      if (d === null) return;
      const dd = clamp(d, s.minDelta, s.maxDelta);
      value = clamp(value + dd, 0, s.max);
      applied[i] = dd;
    });
    return { value, applied };
  }

  function fmt(n) { return (n > 0 ? '+' : '') + n; }

  function ensureBar() {
    if ($('#fa-like-bar').length) return;
    const bar = $(`
      <div id="fa-like-bar">
        <div class="fa-lv"><span class="fa-lv-ic"></span><span class="fa-lv-name"></span></div>
        <div class="fa-track"><div class="fa-fill"></div><div class="fa-num"></div></div>
      </div>`);
    $('#chat').before(bar);
  }

  function renderBar(value) {
    const s = settings();
    ensureBar();
    const bar = $('#fa-like-bar');
    bar.toggleClass('fa-hidden', !s.enabled);
    const [, label, icon] = levelFor(value, s.max);
    bar.find('.fa-lv-ic').text(icon);
    bar.find('.fa-lv-name').text(label);
    bar.find('.fa-fill').css('width', (value / s.max) * 100 + '%');
    bar.find('.fa-num').text(`❤️ ${value} / ${s.max}`);
  }

  function updatePrompt(value) {
    const s = settings();
    const c = ctx();
    if (!s.enabled) {
      c.setExtensionPrompt(PROMPT_KEY, '', 1, 0, false, 0);
      return;
    }
    const [, label] = levelFor(value, s.max);
    const text =
      `[ระบบค่าความชอบ: ตอนนี้ ${s.name} ชอบ {{user}} ${value}/${s.max} (สถานะ: ${label})\n` +
      `ท้ายคำตอบทุกครั้ง ให้เติมบรรทัดสุดท้ายเป็นรูปแบบนี้เท่านั้น: [LIKE:+N] โดย N คือจำนวนเต็มตั้งแต่ ${s.minDelta} ถึง +${s.maxDelta} ` +
      `ที่แสดงว่าความชอบของ${s.name}ที่มีต่อ {{user}} เปลี่ยนไปเท่าไหร่ในตานี้ (ถ้าไม่เปลี่ยนให้ใส่ [LIKE:+0])\n` +
      `ปรับทีละน้อยให้เข้ากับนิสัยของ${s.name} ซึ่งปากแข็งและไม่ยอมรับความรู้สึกตรงๆ ` +
      `ห้ามพูดถึงระบบนี้หรือแท็กนี้ในเนื้อเรื่อง และห้ามใส่ตัวเลขนี้ที่อื่น]`;
    c.setExtensionPrompt(PROMPT_KEY, text, 1, 0, false, 0);
  }

  function decorate(applied) {
    const chat = ctx().chat || [];
    document.querySelectorAll('#chat .mes').forEach((el) => {
      const id = Number(el.getAttribute('mesid'));
      const msg = chat[id];
      if (!msg || msg.is_user) return;
      const mt = el.querySelector('.mes_text');
      if (!mt) return;

      // hide the tag in the displayed text (only touch the DOM if it is present)
      TAG_RE.lastIndex = 0;
      if (TAG_RE.test(mt.innerHTML)) {
        TAG_RE.lastIndex = 0;
        mt.innerHTML = mt.innerHTML.replace(TAG_RE, '').replace(/(<br\s*\/?>|\s)+$/i, '');
      }

      const d = applied[id];
      const old = el.querySelector('.fa-chip');
      if (d === undefined) {
        if (old) old.remove();
        return;
      }
      const text = `❤️ ${fmt(d)}`;
      if (old && old.dataset.v === String(d)) return;
      if (old) old.remove();
      const chip = document.createElement('div');
      chip.className = 'fa-chip' + (d < 0 ? ' fa-neg' : d === 0 ? ' fa-zero' : '');
      chip.dataset.v = String(d);
      chip.textContent = text;
      mt.insertAdjacentElement('afterend', chip);
    });
  }

  let busy = false;
  function refresh() {
    if (busy) return;
    busy = true;
    try {
      const { value, applied } = compute();
      renderBar(value);
      updatePrompt(value);
      if (settings().enabled) decorate(applied);
    } catch (e) {
      console.error('[faifah_affection]', e);
    } finally {
      busy = false;
    }
  }

  let timer = null;
  const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(refresh, 150); };

  function buildSettingsUI() {
    const s = settings();
    const html = `
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>FAIFAH Affection Bar</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <label class="checkbox_label"><input type="checkbox" id="fa_enabled"><span>เปิดใช้งาน</span></label>
          <label>ชื่อตัวละคร <input type="text" id="fa_name" class="text_pole"></label>
          <label>ค่าเริ่มต้น <input type="number" id="fa_start" class="text_pole"></label>
          <label>ค่าสูงสุด <input type="number" id="fa_max" class="text_pole"></label>
          <label>ลดได้สุด ต่อข้อความ <input type="number" id="fa_min" class="text_pole"></label>
          <label>เพิ่มได้สุด ต่อข้อความ <input type="number" id="fa_maxd" class="text_pole"></label>
        </div>
      </div>`;
    $('#extensions_settings2').append(html);
    $('#fa_enabled').prop('checked', s.enabled).on('change', function () { s.enabled = this.checked; save(); refresh(); });
    $('#fa_name').val(s.name).on('input', function () { s.name = this.value || DEFAULTS.name; save(); refresh(); });
    $('#fa_start').val(s.start).on('input', function () { s.start = Number(this.value) || 0; save(); refresh(); });
    $('#fa_max').val(s.max).on('input', function () { s.max = Math.max(1, Number(this.value) || 1000); save(); refresh(); });
    $('#fa_min').val(s.minDelta).on('input', function () { s.minDelta = Number(this.value) || -10; save(); refresh(); });
    $('#fa_maxd').val(s.maxDelta).on('input', function () { s.maxDelta = Number(this.value) || 15; save(); refresh(); });
  }

  jQuery(() => {
    const c = ctx();
    settings();
    buildSettingsUI();
    ensureBar();
    const ev = c.eventSource, T = c.event_types;
    [T.CHAT_CHANGED, T.MESSAGE_RECEIVED, T.MESSAGE_SENT, T.MESSAGE_EDITED, T.MESSAGE_UPDATED,
     T.MESSAGE_SWIPED, T.MESSAGE_DELETED, T.CHARACTER_MESSAGE_RENDERED, T.GENERATION_ENDED]
      .filter(Boolean)
      .forEach((e) => ev.on(e, refreshSoon));
    // re-decorate when ST re-renders the chat DOM
    const chatEl = document.getElementById('chat');
    if (chatEl) new MutationObserver(refreshSoon).observe(chatEl, { childList: true, subtree: true, characterData: true });
    refresh();
  });
})();
