// --- Helper: Generate a random code ---
function generateRandomCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Show/hide file input and textarea based on selection
const fileTypeSelect = document.getElementById("fileType");
const fileInput = document.getElementById("fileInput");
const textWriteArea = document.getElementById("textWriteArea");

function setFileAcceptForType(type) {
  if (!fileInput) return;
  switch (type) {
    case 'image':
      fileInput.accept = 'image/*';
      break;
    case 'audio':
      fileInput.accept = 'audio/*';
      break;
    case 'video':
      fileInput.accept = 'video/*';
      break;
    case 'text':
      fileInput.accept = '.txt,text/plain';
      break;
    default:
      fileInput.accept = '';
  }
}

fileTypeSelect?.addEventListener("change", function () {
  if (this.value === "text-write") {
    if (fileInput) {
      fileInput.style.display = "none";
      fileInput.required = false;
      // clear previously selected file if any
      try { fileInput.value = ""; } catch (e) {}
    }
    if (textWriteArea) {
      textWriteArea.style.display = "block";
      textWriteArea.required = true;
    }
  } else {
    if (fileInput) {
      fileInput.style.display = "block";
      fileInput.required = true;
    }
    if (textWriteArea) {
      textWriteArea.style.display = "none";
      textWriteArea.required = false;
    }
    setFileAcceptForType(this.value);
  }
});

// Initialize accept attribute on page load if select exists
if (fileTypeSelect) setFileAcceptForType(fileTypeSelect.value);

// --- Copy code functionality ---
function showCodeWithCopy(code, isPublic) {
  const codeDisplay = document.getElementById("codeDisplay");
  const wrapper = document.getElementById("codeDisplayWrapper");
  if (codeDisplay) codeDisplay.innerText = `Your download code is: ${code}`;

  // Remove any old copy button
  let oldBtn = document.getElementById("copyCodeBtn");
  if (oldBtn) oldBtn.remove();

  // Create new copy button (SVG)
  const btn = document.createElement("button");
  btn.id = "copyCodeBtn";
  btn.type = "button";
  btn.title = "Copy code";

  btn.innerHTML = `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;

  btn.onclick = function () {
    // Copy the code part only
    navigator.clipboard.writeText(code).then(() => {
      btn.classList.add('copied');
      btn.title = "Copied!";
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.title = "Copy code";
      }, 1200);
    });
  };

  wrapper.appendChild(btn);

  // Optionally show an indicator that it's public
  let oldPublicNote = document.getElementById("publicNote");
  if (oldPublicNote) oldPublicNote.remove();
  if (isPublic) {
    const note = document.createElement("div");
    note.id = "publicNote";
    note.style.color = "#fff";
    note.style.fontSize = "0.9rem";
    note.style.marginTop = "8px";
    note.style.textAlign = "center";
    note.innerText = "This code has been shared publicly. Anyone can preview/download it.";
    wrapper.appendChild(note);
  }
}

// Handle upload (file or written text)
document.getElementById("uploadForm")?.addEventListener("submit", function (e) {
  e.preventDefault();
  const type = fileTypeSelect ? fileTypeSelect.value : "image";

  // Generate a code and ensure it's unique in localStorage
  let code;
  do {
    code = generateRandomCode();
  } while (localStorage.getItem(code) || localStorage.getItem('public_' + code)); // avoid collisions

  const sharePublicCheckbox = document.getElementById("sharePublicCheckbox");
  const isPublic = !!(sharePublicCheckbox && sharePublicCheckbox.checked);

  if (type === "text-write") {
    const text = textWriteArea.value;
    if (!text) {
      alert("Please write some text to upload.");
      return;
    }
    const dataUrl = "data:text/plain;base64," + btoa(unescape(encodeURIComponent(text)));
    const obj = {
      name: "written-text.txt",
      type: type,
      data: dataUrl,
      public: isPublic
    };
    localStorage.setItem(code, JSON.stringify(obj));
    if (isPublic) {
      localStorage.setItem('public_' + code, JSON.stringify(obj));
      addToPublicIndex(code, obj.name);
    }
    showCodeWithCopy(code, isPublic);
  } else {
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function () {
        const obj = {
          name: file.name,
          type: type,
          data: reader.result,
          public: isPublic
        };
        localStorage.setItem(code, JSON.stringify(obj));
        if (isPublic) {
          localStorage.setItem('public_' + code, JSON.stringify(obj));
          addToPublicIndex(code, obj.name);
        }
        showCodeWithCopy(code, isPublic);
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please select a file to upload.");
    }
  }
});

// Add entry to public index (stored as array of {code, name, created_at})
function addToPublicIndex(code, name) {
  try {
    const raw = localStorage.getItem('public_codes');
    const list = raw ? JSON.parse(raw) : [];
    const upper = code.toUpperCase();
    // avoid duplicate entries
    if (!list.some(item => item.code === upper)) {
      list.push({ code: upper, name: name, created_at: new Date().toISOString() });
      localStorage.setItem('public_codes', JSON.stringify(list));
    }
  } catch (e) {
    // fail silently
    console.error('Failed to add to public index', e);
  }
}

// --- Download page logic with preview before download ---
const downloadForm = document.getElementById("downloadForm");
const fileInfoDiv = document.getElementById("fileInfo");
const filePreviewDiv = document.getElementById("filePreview");
const downloadBtn = document.getElementById("downloadBtn");
const fileLinkDiv = document.getElementById("fileLink");
const publicListDiv = document.getElementById("publicList");
const showPublicBtn = document.getElementById("showPublicBtn");

function previewByFileData(fileData, code, isPublicFallback) {
  if (fileInfoDiv) fileInfoDiv.innerHTML = "";
  if (filePreviewDiv) filePreviewDiv.innerHTML = "";
  if (fileLinkDiv) fileLinkDiv.innerHTML = "";
  if (downloadBtn) downloadBtn.style.display = "none";

  if (!fileData) {
    if (fileInfoDiv) fileInfoDiv.textContent = "No file is currently stored for this code or it has expired.";
    return;
  }

  if (isPublicFallback && fileInfoDiv) {
    fileInfoDiv.textContent = "This file is shared publicly.";
  }

  // Preview
  if (fileData.type === "image") {
    const img = document.createElement("img");
    img.src = fileData.data;
    img.alt = fileData.name;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "200px";
    if (filePreviewDiv) filePreviewDiv.appendChild(img);
  } else if (fileData.type === "audio") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = fileData.data;
    if (filePreviewDiv) filePreviewDiv.appendChild(audio);
  } else if (fileData.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.src = fileData.data;
    video.style.maxWidth = "100%";
    video.style.maxHeight = "300px";
    video.style.display = "block";
    video.style.margin = "0 auto";
    if (filePreviewDiv) filePreviewDiv.appendChild(video);
  } else if (fileData.type === "text") {
    const p = document.createElement("pre");
    const dataUrl = fileData.data;
    if (dataUrl && dataUrl.startsWith("data:")) {
      const base64 = dataUrl.split(",")[1];
      try {
        const text = decodeURIComponent(escape(window.atob(base64)));
        p.textContent = text.length > 1000 ? text.slice(0, 1000) + "\n...(truncated)" : text;
      } catch (e) {
        p.textContent = "Unable to preview this text file.";
      }
    } else {
      p.textContent = "Unable to preview this text file.";
    }
    if (filePreviewDiv) filePreviewDiv.appendChild(p);
  } else if (fileData.type === "text-write") {
    const p = document.createElement("pre");
    const base64 = (fileData.data || "").split(",")[1] || "";
    let text = "";
    try {
      text = decodeURIComponent(escape(window.atob(base64)));
    } catch (e) {
      text = "Unable to preview this text file.";
    }
    p.textContent = text.length > 1000 ? text.slice(0, 1000) + "\n...(truncated)" : text;
    if (filePreviewDiv) filePreviewDiv.appendChild(p);
  } else {
    const p = document.createElement("div");
    p.textContent = `Cannot preview file type: ${fileData.type}`;
    if (filePreviewDiv) filePreviewDiv.appendChild(p);
  }

  // Show download button
  if (downloadBtn) {
    downloadBtn.style.display = "block";
    downloadBtn.onclick = function () {
      const link = document.createElement("a");
      link.href = fileData.data;
      link.download = fileData.name;
      link.click();
    };
  }

  // Direct link (fallback)
  if (fileLinkDiv && !fileLinkDiv.hasChildNodes()) {
    const link = document.createElement("a");
    link.href = fileData.data;
    link.download = fileData.name;
    link.innerText = `Click to download ${fileData.name}`;
    fileLinkDiv.innerHTML = "";
    fileLinkDiv.appendChild(link);
  }
}

if (downloadForm) {
  downloadForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const codeInputElem = document.getElementById("codeInput");
    const code = codeInputElem ? codeInputElem.value.trim().toUpperCase() : "";

    if (fileInfoDiv) fileInfoDiv.innerHTML = "";
    if (filePreviewDiv) filePreviewDiv.innerHTML = "";
    if (fileLinkDiv) fileLinkDiv.innerHTML = "";
    if (downloadBtn) downloadBtn.style.display = "none";

    const fileDataRaw = localStorage.getItem(code);

    if (fileDataRaw) {
      const fileData = JSON.parse(fileDataRaw);
      previewByFileData(fileData, code, false);
    } else {
      // check public storage fallback
      const publicRaw = localStorage.getItem('public_' + code);
      if (publicRaw) {
        const fileData = JSON.parse(publicRaw);
        previewByFileData(fileData, code, true);
      } else {
        if (fileInfoDiv) fileInfoDiv.textContent = "No file is currently stored for this code or it has expired.";
      }
    }
  });
}

// (Optional) Direct download link for legacy/fallback support
document.getElementById("downloadForm")?.addEventListener("submit", function (e) {
  // this handler is kept for backward compatibility but main preview is handled above
  const code = (document.getElementById("codeInput")?.value || "").trim().toUpperCase();
  const fileDataRaw = localStorage.getItem(code) || localStorage.getItem('public_' + code);
  if (fileDataRaw && fileLinkDiv && !fileLinkDiv.hasChildNodes()) {
    const fileData = JSON.parse(fileDataRaw);
    const link = document.createElement("a");
    link.href = fileData.data;
    link.download = fileData.name;
    link.innerText = `Click to download ${fileData.name}`;
    fileLinkDiv.innerHTML = "";
    fileLinkDiv.appendChild(link);
  } else if (!fileDataRaw && fileLinkDiv) {
    fileLinkDiv.innerText = "No file is currently stored for this code or it has expired.";
  }
});

// Public list browsing (download page)
function renderPublicList() {
  if (!publicListDiv) return;
  publicListDiv.innerHTML = "";

  const raw = localStorage.getItem('public_codes');
  const list = raw ? JSON.parse(raw) : [];

  const wrapper = document.createElement('div');
  wrapper.style.background = "rgba(30,0,0,0.9)";
  wrapper.style.border = "1px solid #ff3b3b";
  wrapper.style.borderRadius = "12px";
  wrapper.style.padding = "12px";
  wrapper.style.color = "#fff";

  if (list.length === 0) {
    const p = document.createElement('div');
    p.style.textAlign = "center";
    p.style.color = "#ff3b3b";
    p.textContent = "No public/shared codes available.";
    wrapper.appendChild(p);
    publicListDiv.appendChild(wrapper);
    return;
  }

  const ul = document.createElement('ul');
  ul.style.listStyle = "none";
  ul.style.padding = "0";
  ul.style.margin = "0";

  list.slice().reverse().forEach(item => {
    const li = document.createElement('li');
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.padding = "8px 6px";
    li.style.borderBottom = "1px solid rgba(255,59,59,0.04)";

    const left = document.createElement('div');
    left.style.flex = "1";
    left.innerHTML = `<strong style="color:#ff3b3b;margin-right:8px">${escapeHtml(item.code)}</strong><span style="color:#fff">${escapeHtml(item.name || '')}</span>`;

    const actions = document.createElement('div');

    const viewBtn = document.createElement('button');
    viewBtn.type = "button";
    viewBtn.textContent = "Preview";
    viewBtn.onclick = () => {
      const codeInputElem = document.getElementById("codeInput");
      if (codeInputElem) codeInputElem.value = item.code;
      // trigger form submit to preview
      const ev = new Event('submit', { bubbles: true, cancelable: true });
      downloadForm.dispatchEvent(ev);
      // scroll to preview
      setTimeout(() => {
        document.getElementById("filePreview")?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    };

    const copyBtn = document.createElement('button');
    copyBtn.type = "button";
    copyBtn.textContent = "Copy Code";
    copyBtn.style.marginLeft = "8px";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(item.code).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => copyBtn.textContent = "Copy Code", 1200);
      });
    };

    actions.appendChild(viewBtn);
    actions.appendChild(copyBtn);

    li.appendChild(left);
    li.appendChild(actions);
    ul.appendChild(li);
  });

  wrapper.appendChild(ul);
  publicListDiv.appendChild(wrapper);
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, function(m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
  });
}

showPublicBtn?.addEventListener('click', function () {
  renderPublicList();
  // toggle scroll
  publicListDiv.scrollIntoView({ behavior: 'smooth' });
});