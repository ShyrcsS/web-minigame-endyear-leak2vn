import { normalizeUid } from '../quiz.js';

const MAX_FILE_MB = 5;

function mb(n) {
  return n * 1024 * 1024;
}

export function createIntakeFlow({
  els,
  session,
  apiBase,
  createEntry,
  uploadScreenshot,
  normalizeFacebookUrl,
  saveProgress,
  startQuiz,
}) {
  function wireScreenshotPreview() {
    els.screenshot.addEventListener('change', () => {
      els.screenshotPreview.innerHTML = '';
      const file = els.screenshot.files?.[0];
      if (!file) return;

      const img = document.createElement('img');
      img.alt = 'Preview screenshot';
      img.src = URL.createObjectURL(file);

      const meta = document.createElement('div');
      meta.className = 'muted tiny';
      meta.textContent = `File: ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;

      els.screenshotPreview.appendChild(meta);
      els.screenshotPreview.appendChild(img);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = els.intakeForm.querySelector('button[type="submit"]');
    const prevText = submitBtn?.textContent || '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang tải ảnh…';
    }

    try {
      const uid = normalizeUid(els.uid.value);
      if (!uid) {
        alert('UID Không Hợp Lệ');
        return;
      }

      const ingameName = els.ingameName.value.trim();
      if (!ingameName) {
        alert('Vui Lòng Phải Nhập Tên Ingame Của Bạn');
        return;
      }

      const fbLink = normalizeFacebookUrl(els.fbLink.value);
      if (!fbLink) {
        alert('Link Facebook Chưa Ổn (Ví Dụ: https://www.facebook.com/username)');
        return;
      }

      const file = els.screenshot.files?.[0];
      if (!file) {
        alert('Bạn Cần Chọn Ảnh Chụp.');
        return;
      }

      if (file.size > mb(MAX_FILE_MB)) {
        alert(`Ảnh Quá Lớn (Tối Đa ${MAX_FILE_MB}MB).`);
        return;
      }

      session.uid = uid;
      session.ingameName = ingameName;
      session.fbLink = fbLink;

      try {
        session.imageKey = await uploadScreenshot({ apiBase, file });
        saveProgress({
          uid: session.uid,
          ingameName: session.ingameName,
          fbLink: session.fbLink,
          imageKey: session.imageKey,
          loreScore: 0,
          quizDone: false,
        });

        if (createEntry) {
          try {
            await createEntry({
              apiBase,
              entry: {
                uid: session.uid,
                ingameName: session.ingameName,
                fbLink: session.fbLink,
                imageKey: session.imageKey,
                loreScore: 0,
                gaTotal: 0,
                winBonus: 0,
              },
            });
          } catch (errCreate) {
            const msg = String(errCreate?.message || '').toLowerCase();
            // Nếu UID đã tồn tại thì bỏ qua
            if (!msg.includes('uid already exists')) {
              throw errCreate;
            }
          }
        }
      } catch (err) {
        console.error(err);
        alert(`Upload ảnh hoặc tạo hồ sơ lỗi: ${err?.message || 'lỗi không rõ'}`);
        return;
      }

      if (submitBtn) submitBtn.textContent = 'Đang vào quiz…';

      try {
        await startQuiz();
      } catch (err) {
        console.error(err);
        alert(`Không vào được Quiz: ${err?.message || 'lỗi không rõ'}`);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = prevText;
      }
    }
  }

  function wireFormSubmit() {
    els.intakeForm.addEventListener('submit', handleSubmit);
  }

  return {
    wireScreenshotPreview,
    wireFormSubmit,
  };
}
