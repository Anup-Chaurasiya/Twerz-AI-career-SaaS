/** Shared ATS detection + form scraping for Apply Assist. */

function abHost() {
  return (location.hostname || '').toLowerCase();
}

function abIsWorkday() {
  return abHost().includes('myworkdayjobs.com') || abHost().includes('myworkdaysite.com');
}

function abIsGreenhouse() {
  return abHost().includes('greenhouse.io');
}

function abIsLever() {
  return abHost().includes('lever.co');
}

function abIsApplyFormPage() {
  const host = abHost();
  const path = (location.pathname || '').toLowerCase();
  if (abIsGreenhouse()) {
    return (
      path.includes('/applications') ||
      !!document.querySelector('#application_form, form[action*="application"], input[type="file"]')
    );
  }
  if (abIsLever()) {
    return path.includes('/apply') || !!document.querySelector('.application-form, .posting-apply');
  }
  if (abIsWorkday()) {
    return (
      path.includes('/apply') ||
      !!document.querySelector(
        '[data-automation-id="file-upload-input-ref"], input[type="file"], [data-automation-id="applyButton"]',
      )
    );
  }
  return false;
}

function abScrapeFormQuestions() {
  const questions = [];
  const seen = new Set();

  const pushQuestion = (label, id) => {
    const clean = (label || '').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length < 2 || seen.has(clean)) return;
    seen.add(clean);
    questions.push({ id: id || clean, label: clean });
  };

  if (abIsWorkday()) {
    document.querySelectorAll('[data-automation-id]').forEach((el) => {
      const automationId = el.getAttribute('data-automation-id') || '';
      if (!/formField|textInput|textArea|question/i.test(automationId)) return;
      const label =
        el.getAttribute('aria-label') ||
        el.closest('[role="group"]')?.querySelector('label')?.innerText ||
        el.querySelector('label')?.innerText ||
        '';
      const input = el.querySelector('input, textarea, select') || (el.matches('input,textarea,select') ? el : null);
      const inputId = input?.id || input?.name || automationId;
      pushQuestion(label, inputId);
    });
  }

  const selectors = [
    'label[for]',
    '.field label',
    '.application-label',
    '.application-question',
    '.posting-requirement .application-label',
    '[data-automation-id="richText"] label',
  ];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((labelEl) => {
      const label = (labelEl.innerText || labelEl.textContent || '').trim();
      const htmlFor = labelEl.getAttribute('for');
      pushQuestion(label, htmlFor);
    });
  }
  return questions;
}

function abFindCoverLetterField() {
  const candidates = [
    'textarea[name*="cover" i]',
    'textarea[id*="cover" i]',
    'textarea[placeholder*="cover" i]',
    'textarea[data-automation-id*="cover" i]',
    'textarea[name*="comments" i]',
    'textarea[id*="comments" i]',
    '[data-automation-id="richTextArea"] textarea',
    'textarea',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function abFindResumeInput() {
  return (
    document.querySelector(
      'input[type="file"][name*="resume" i], input[type="file"][id*="resume" i], [data-automation-id="file-upload-input-ref"] input[type="file"], input[type="file"]',
    ) || null
  );
}

function abSetNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function abInjectPdfFile(input, pdfBlob, filename) {
  const file = new File([pdfBlob], filename || 'resume.pdf', { type: 'application/pdf' });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function abResolveFieldTarget(question) {
  const id = question.id || '';
  if (id) {
    const byId = document.getElementById(id);
    if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLTextAreaElement || byId instanceof HTMLSelectElement)) {
      return byId;
    }
    try {
      const byName = document.querySelector(`[name="${CSS.escape(id)}"]`);
      if (byName) return byName;
    } catch (_) {
      const byName = document.querySelector(`[name="${id.replace(/"/g, '\\"')}"]`);
      if (byName) return byName;
    }
  }
  const labels = Array.from(document.querySelectorAll('label'));
  for (const labelEl of labels) {
    const text = (labelEl.innerText || labelEl.textContent || '').trim();
    if (text !== question.label) continue;
    const htmlFor = labelEl.getAttribute('for');
    if (htmlFor) {
      const target = document.getElementById(htmlFor);
      if (target) return target;
    }
    const nested = labelEl.querySelector('input, textarea, select');
    if (nested) return nested;
  }
  return null;
}

function abFillAnswer(target, value) {
  if (!target || value == null) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    abSetNativeValue(target, value);
    return true;
  }
  if (target instanceof HTMLSelectElement) {
    const lower = value.toLowerCase();
    for (const opt of Array.from(target.options)) {
      if ((opt.text || opt.value || '').toLowerCase().includes(lower)) {
        target.value = opt.value;
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
  }
  return false;
}

function abSendBg(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function abFitClass(label) {
  const normalized = (label || '').toUpperCase();
  if (normalized === 'STRONG') return 'ab-fit-strong';
  if (normalized === 'STRETCH') return 'ab-fit-stretch';
  return 'ab-fit-mismatch';
}

function abLogoUrl(size = 32) {
  return chrome.runtime.getURL(`icons/icon${size}.png`);
}

function abBrandHeader(title = 'Twerz', subtitle = 'Apply Assist') {
  return `
    <div class="ab-brand">
      <img src="${abLogoUrl(32)}" alt="Twerz" />
      <div class="ab-brand-text">
        <span class="ab-brand-name">${title}</span>
        <span class="ab-brand-sub">${subtitle}</span>
      </div>
    </div>
  `;
}

function abFabLabel(text) {
  return `<img src="${abLogoUrl(16)}" alt="" class="ab-fab-icon" />${text}`;
}
