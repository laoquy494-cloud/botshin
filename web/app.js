/**
 * Shin Bot Documentation & Commands Center — Main Interactive Logic
 * Handles real-time search, category filtering, permissions filtering,
 * interactive command builder, Discord embed preview, modal view, and sound effects.
 */

// Sound effects state
let soundEnabled = true;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
}

function playSound(type = 'click') {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'copy') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(780, now + 0.06);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'open') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch (e) {
    // Ignore audio errors on unsupported browsers
  }
}

// Toast Notifications
function showToast(message, icon = '📋') {
  playSound('copy');
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, 2200);
}

// Copy to clipboard helper
function copyText(text, successMsg = 'Đã sao chép vào bộ nhớ tạm!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, '✅');
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, '✅');
  } catch (err) {
    showToast('Lỗi khi sao chép!', '❌');
  }
  document.body.removeChild(textArea);
}

// State variables
let currentCategory = 'all';
let currentSearch = '';
let currentPerm = 'all';
let currentType = 'all';
let currentSort = 'default';
let activeModalCmd = null;

// Safe Application Initialization
function initApp() {
  renderCategoryTabs();
  renderCommands();
  setupEventListeners();
  updateTotalCounters();
  initSnowfall();
  initCursorFollower();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function updateTotalCounters() {
  const statCmds = document.getElementById('stat-total-cmds');
  if (statCmds && typeof COMMANDS_DATA !== 'undefined') {
    statCmds.textContent = `${COMMANDS_DATA.length}+`;
  }
  const statCats = document.getElementById('stat-total-cats');
  if (statCats && typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.categories) {
    statCats.textContent = `${BOT_CONFIG.categories.filter(c => c.id !== 'all').length}`;
  }
}

// 1. Render Category Tabs
function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container || typeof BOT_CONFIG === 'undefined' || typeof COMMANDS_DATA === 'undefined') return;

  container.innerHTML = '';

  BOT_CONFIG.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `cat-tab-btn ${cat.id === currentCategory ? 'active' : ''}`;
    btn.dataset.category = cat.id;

    // Calculate actual count from COMMANDS_DATA
    const count = cat.id === 'all' 
      ? COMMANDS_DATA.length 
      : COMMANDS_DATA.filter(c => c.category === cat.id).length;

    btn.innerHTML = `
      <span>${cat.icon}</span>
      <span>${cat.name}</span>
      <span class="cat-tab-count">${count}</span>
    `;

    btn.addEventListener('click', () => {
      playSound('click');
      currentCategory = cat.id;
      document.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCommands();
    });

    container.appendChild(btn);
  });
}

// 2. Filter & Sort Commands
function getFilteredCommands() {
  if (typeof COMMANDS_DATA === 'undefined') return [];
  let list = [...COMMANDS_DATA];

  // Category filter
  if (currentCategory !== 'all') {
    list = list.filter(cmd => cmd.category === currentCategory);
  }

  // Permission filter
  if (currentPerm !== 'all') {
    list = list.filter(cmd => cmd.perm_level === currentPerm);
  }

  // Type filter
  if (currentType !== 'all') {
    list = list.filter(cmd => cmd.type === currentType);
  }

  // Search query filter
  if (currentSearch.trim() !== '') {
    const q = currentSearch.trim().toLowerCase();
    list = list.filter(cmd => {
      const nameMatch = (cmd.name || '').toLowerCase().includes(q);
      const descMatch = (cmd.description || '').toLowerCase().includes(q);
      const aliasMatch = cmd.aliases && cmd.aliases.some(a => a.toLowerCase().includes(q));
      const syntaxMatch = (cmd.prefix_syntax && cmd.prefix_syntax.toLowerCase().includes(q)) ||
                          (cmd.slash_syntax && cmd.slash_syntax.toLowerCase().includes(q));
      const paramMatch = cmd.parameters && cmd.parameters.some(p => (p.name || '').toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
      const condMatch = cmd.conditions && cmd.conditions.some(c => c.toLowerCase().includes(q));
      return nameMatch || descMatch || aliasMatch || syntaxMatch || paramMatch || condMatch;
    });
  }

  // Sorting
  if (currentSort === 'name-asc') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === 'name-desc') {
    list.sort((a, b) => b.name.localeCompare(a.name));
  } else if (currentSort === 'perm') {
    const permOrder = { 'everyone': 1, 'moderator': 2, 'manage_guild': 3, 'admin': 4, 'owner': 5 };
    list.sort((a, b) => (permOrder[a.perm_level] || 0) - (permOrder[b.perm_level] || 0));
  }

  return list;
}

// 3. Render Command Cards
function renderCommands() {
  const container = document.getElementById('commands-grid');
  const emptyState = document.getElementById('no-results-state');
  const countBadge = document.getElementById('filtered-count');

  if (!container) return;

  const filtered = getFilteredCommands();

  if (countBadge) {
    countBadge.textContent = filtered.length;
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = '';

  filtered.forEach(cmd => {
    const card = document.createElement('div');
    card.className = 'command-card';

    // Type badge class
    let typeBadgeClass = 'badge-hybrid';
    if (cmd.type === 'slash') typeBadgeClass = 'badge-slash';
    if (cmd.type === 'prefix') typeBadgeClass = 'badge-prefix';

    // Perm badge class
    let permBadgeClass = 'badge-perm-everyone';
    let permLabel = 'Mọi Người';
    if (cmd.perm_level === 'moderator') {
      permBadgeClass = 'badge-perm-mod';
      permLabel = 'Quản Trị';
    } else if (cmd.perm_level === 'manage_guild') {
      permBadgeClass = 'badge-perm-mod';
      permLabel = 'Manage Server';
    } else if (cmd.perm_level === 'admin') {
      permBadgeClass = 'badge-perm-admin';
      permLabel = 'Admin';
    } else if (cmd.perm_level === 'owner') {
      permBadgeClass = 'badge-perm-owner';
      permLabel = 'Chỉ Owner';
    }

    // Aliases HTML
    let aliasesHtml = '';
    if (cmd.aliases && cmd.aliases.length > 0) {
      aliasesHtml = `
        <div class="card-aliases">
          <span class="alias-label">Alias:</span>
          ${cmd.aliases.map(a => `<span class="alias-chip">${(typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.prefix) || '.'}${a}</span>`).join('')}
        </div>
      `;
    }

    // Conditions count chip
    const condCount = cmd.conditions ? cmd.conditions.length : 0;
    const condChip = condCount > 0 ? `<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 0.7rem;">📋 ${condCount} điều kiện</span>` : '';

    card.innerHTML = `
      <div>
        <div class="card-top">
          <div class="card-title-group">
            <span class="card-icon">${cmd.icon}</span>
            <div>
              <h3 class="card-name">/${cmd.name}</h3>
            </div>
          </div>
          <div class="card-badges">
            <span class="badge ${typeBadgeClass}">${cmd.type_label}</span>
            <span class="badge ${permBadgeClass}">${permLabel}</span>
          </div>
        </div>

        <p class="card-desc">${cmd.description}</p>

        ${aliasesHtml}

        <div class="syntax-preview">
          <code>${cmd.prefix_syntax || cmd.slash_syntax}</code>
          <button class="copy-syntax-btn" title="Sao chép cú pháp" data-syntax="${cmd.prefix_syntax || cmd.slash_syntax}">
            📋
          </button>
        </div>
      </div>

      <div class="card-actions">
        ${condChip}
        <button class="view-detail-btn" data-id="${cmd.id}">
          <span>Chi Tiết & Tham Số</span>
          <span>➔</span>
        </button>
      </div>
    `;

    // Event listeners for card buttons
    const copyBtn = card.querySelector('.copy-syntax-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const syntax = copyBtn.getAttribute('data-syntax');
        copyText(syntax, `Đã sao chép: ${syntax}`);
      });
    }

    const detailBtn = card.querySelector('.view-detail-btn');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCommandModal(cmd);
      });
    }

    // Click whole card to open details
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.copy-syntax-btn') && !e.target.closest('.view-detail-btn')) {
        openCommandModal(cmd);
      }
    });

    container.appendChild(card);
  });
}

// 4. Command Detail Modal Logic
function openCommandModal(cmd) {
  playSound('open');
  activeModalCmd = cmd;
  const modal = document.getElementById('command-modal');
  if (!modal) return;

  // Header info
  document.getElementById('modal-icon').textContent = cmd.icon;
  document.getElementById('modal-title').textContent = cmd.name;
  document.getElementById('modal-short-desc').textContent = cmd.description;

  // Badges
  const typeBadge = document.getElementById('modal-type-badge');
  typeBadge.textContent = cmd.type_label;
  typeBadge.className = 'badge ' + (cmd.type === 'slash' ? 'badge-slash' : cmd.type === 'prefix' ? 'badge-prefix' : 'badge-hybrid');

  const catBadge = document.getElementById('modal-cat-badge');
  catBadge.textContent = cmd.category_name;

  // Syntax codes
  document.getElementById('modal-prefix-syntax').textContent = cmd.prefix_syntax || "Không hỗ trợ";
  document.getElementById('modal-slash-syntax').textContent = cmd.slash_syntax || "Không hỗ trợ";

  // Aliases
  const aliasSection = document.getElementById('modal-aliases-section');
  const aliasContainer = document.getElementById('modal-aliases-container');
  if (cmd.aliases && cmd.aliases.length > 0) {
    aliasSection.style.display = 'block';
    aliasContainer.innerHTML = cmd.aliases.map(a => `<span class="alias-chip">${(typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.prefix) || '.'}${a} hoặc /${a}</span>`).join('');
  } else {
    aliasSection.style.display = 'none';
  }

  // Detailed description
  document.getElementById('modal-detailed-desc').textContent = cmd.detailed_desc || cmd.description;

  // Conditions Checklist
  const condList = document.getElementById('modal-conditions-list');
  condList.innerHTML = '';
  if (cmd.conditions && cmd.conditions.length > 0) {
    cmd.conditions.forEach(c => {
      const row = document.createElement('div');
      row.className = 'cond-row';
      row.innerHTML = `
        <span class="cond-icon">✓</span>
        <span>${c}</span>
      `;
      condList.appendChild(row);
    });
  } else {
    condList.innerHTML = `<div class="cond-row"><span class="cond-icon">✓</span><span>Không có điều kiện ràng buộc đặc biệt.</span></div>`;
  }

  // Parameters Table
  const paramsSection = document.getElementById('modal-params-section');
  const paramsTbody = document.getElementById('modal-params-tbody');
  if (cmd.parameters && cmd.parameters.length > 0) {
    paramsSection.style.display = 'block';
    paramsTbody.innerHTML = cmd.parameters.map(p => `
      <tr>
        <td><code>${p.name}</code></td>
        <td>${p.type}</td>
        <td>${p.required ? '<strong style="color: var(--red);">Bắt buộc</strong>' : '<span style="color: var(--green);">Tùy chọn</span>'}</td>
        <td>${p.default !== null && p.default !== undefined ? `<code>${p.default}</code>` : '<em>Không có</em>'}</td>
        <td>${p.description || '-'}</td>
      </tr>
    `).join('');
  } else {
    paramsSection.style.display = 'none';
  }

  // Interactive Syntax Builder
  setupSyntaxBuilder(cmd);

  // Examples List
  const examplesList = document.getElementById('modal-examples-list');
  examplesList.innerHTML = '';
  if (cmd.examples && cmd.examples.length > 0) {
    cmd.examples.forEach(ex => {
      const row = document.createElement('div');
      row.className = 'example-row';
      row.innerHTML = `
        <div class="example-info">
          <code>${ex.cmd}</code>
          <span class="example-desc">${ex.desc}</span>
        </div>
        <button class="copy-btn-sm" title="Sao chép ví dụ" data-cmd="${ex.cmd}">📋</button>
      `;
      row.querySelector('.copy-btn-sm').addEventListener('click', (e) => {
        e.stopPropagation();
        copyText(ex.cmd, `Đã sao chép: ${ex.cmd}`);
      });
      examplesList.appendChild(row);
    });
  }

  // Discord Embed Preview
  setupDiscordEmbedPreview(cmd);

  // Show modal
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.add('active');
  });
  document.body.style.overflow = 'hidden';
}

function closeCommandModal() {
  playSound('click');
  const modal = document.getElementById('command-modal');
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 250);
}

// 5. Interactive Syntax Builder Setup
function setupSyntaxBuilder(cmd) {
  const builderSection = document.getElementById('modal-builder-section');
  const inputsContainer = document.getElementById('modal-builder-inputs');
  const outputCode = document.getElementById('modal-builder-output');
  const copyBuilderBtn = document.getElementById('modal-copy-builder-btn');

  if (!builderSection || !inputsContainer || !outputCode) return;

  if (!cmd.parameters || cmd.parameters.length === 0) {
    builderSection.style.display = 'none';
    return;
  }

  builderSection.style.display = 'block';
  inputsContainer.innerHTML = '';

  const inputValues = {};

  cmd.parameters.forEach(p => {
    const field = document.createElement('div');
    field.className = 'builder-field';

    const label = document.createElement('label');
    label.innerHTML = `${p.name} ${p.required ? '<span style="color:var(--red);">*</span>' : '(tùy chọn)'}:`;

    let inputElement;

    // Check if literal or choices
    if (p.choices && Array.isArray(p.choices) && p.choices.length > 0) {
      inputElement = document.createElement('select');
      p.choices.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt;
        optionEl.textContent = opt;
        inputElement.appendChild(optionEl);
      });
      inputValues[p.name] = p.choices[0];
      inputElement.addEventListener('change', (e) => {
        inputValues[p.name] = e.target.value.trim();
        updateBuilderOutput();
      });
    } else if (p.type.includes('Literal') || p.type.includes('Lựa chọn')) {
      inputElement = document.createElement('select');
      let options = [];
      if (cmd.id === 'cf') options = ['ngua', 'sap'];
      else if (cmd.id === 'loop') options = ['off', 'song', 'queue'];
      else if (cmd.id === 'setruleaction') {
        if (p.name === 'rule') options = ['invite', 'links', 'flood', 'badwords'];
        if (p.name === 'action') options = ['delete', 'timeout', 'kick', 'ban'];
      }
      else if (cmd.id === 'top') options = ['server', 'global'];
      else if (cmd.id === 'invitebypass' || cmd.id === 'linkbypass') options = ['add', 'remove', 'list', 'clear'];
      else if (cmd.id === 'linkchannel') {
        if (p.name === 'action') options = ['panel', 'mode', 'add', 'remove', 'list', 'clear'];
        else if (p.name === 'mode') options = ['all', 'only', 'ignore'];
      }
      else if (cmd.id === 'antilink') options = ['on', 'off', 'status', 'channel', 'mode', 'delete', 'timeout', 'kick', 'ban'];
      else if (cmd.id === 'levelnotify') options = ['on', 'off'];
      else if (cmd.id === 'setlog') options = ['say', 'dms', 'all'];
      else options = ['on', 'off', 'status'];

      options.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt;
        optionEl.textContent = opt;
        inputElement.appendChild(optionEl);
      });
      inputValues[p.name] = options[0];

      inputElement.addEventListener('change', (e) => {
        inputValues[p.name] = e.target.value.trim();
        updateBuilderOutput();
      });
    } else {
      inputElement = document.createElement('input');
      inputElement.type = 'text';
      inputElement.placeholder = p.default ? `Mặc định: ${p.default}` : `Nhập ${p.name}...`;
      if (p.default && p.default !== 'Chính bạn' && p.default !== 'Kênh hiện tại') {
        inputElement.value = p.default;
        inputValues[p.name] = p.default;
      } else {
        inputValues[p.name] = '';
      }

      inputElement.addEventListener('input', (e) => {
        inputValues[p.name] = e.target.value.trim();
        updateBuilderOutput();
      });
    }

    field.appendChild(label);
    field.appendChild(inputElement);
    inputsContainer.appendChild(field);
  });

  function updateBuilderOutput() {
    let prefixResult = `${(typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.prefix) || '.'}${cmd.name}`;
    let slashResult = `/${cmd.name}`;

    cmd.parameters.forEach(p => {
      const val = inputValues[p.name];
      if (val && val !== '') {
        prefixResult += ` ${val}`;
        slashResult += ` ${p.name}: ${val}`;
      }
    });

    const displayResult = (cmd.type === 'slash') ? slashResult : prefixResult;
    outputCode.textContent = displayResult;
    copyBuilderBtn.onclick = () => {
      copyText(displayResult, `Đã sao chép: ${displayResult}`);
    };
  }

  updateBuilderOutput();
}

// 6. Discord Embed Mockup Setup
function setupDiscordEmbedPreview(cmd) {
  const embedSection = document.getElementById('modal-embed-section');
  const embedBar = document.getElementById('embed-bar');
  const embedTitle = document.getElementById('embed-title');
  const embedDesc = document.getElementById('embed-desc');
  const embedFields = document.getElementById('embed-fields');
  const embedFooter = document.getElementById('embed-footer');

  if (!cmd.embed_preview) {
    if (embedSection) embedSection.style.display = 'none';
    return;
  }

  embedSection.style.display = 'block';
  const prev = cmd.embed_preview;

  embedBar.style.backgroundColor = prev.color || '#5865F2';
  embedTitle.textContent = prev.title || '';
  embedDesc.textContent = prev.description || '';

  embedFields.innerHTML = '';
  if (prev.fields && prev.fields.length > 0) {
    prev.fields.forEach(f => {
      const fEl = document.createElement('div');
      fEl.className = 'embed-field';
      fEl.innerHTML = `
        <h6>${f.name}</h6>
        <p>${f.value}</p>
      `;
      embedFields.appendChild(fEl);
    });
  }

  embedFooter.textContent = prev.footer || 'Shin Bot System';
}

// 7. General Event Listeners
function setupEventListeners() {
  // Main Search Input
  const searchInput = document.getElementById('main-search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      if (clearBtn) clearBtn.style.display = currentSearch ? 'block' : 'none';
      renderCommands();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        clearBtn.style.display = 'none';
        searchInput.focus();
        renderCommands();
      });
    }
  }

  // Keyboard shortcut ( / or Ctrl+K )
  window.addEventListener('keydown', (e) => {
    if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && document.activeElement !== searchInput) {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    } else if (e.key === 'Escape') {
      const modal = document.getElementById('command-modal');
      if (modal && modal.classList.contains('active')) {
        closeCommandModal();
      }
    }
  });

  // Secondary Filters
  const permFilter = document.getElementById('perm-filter');
  if (permFilter) {
    permFilter.addEventListener('change', (e) => {
      playSound('click');
      currentPerm = e.target.value;
      renderCommands();
    });
  }

  const typeFilter = document.getElementById('type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      playSound('click');
      currentType = e.target.value;
      renderCommands();
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      playSound('click');
      currentSort = e.target.value;
      renderCommands();
    });
  }

  // Reset Filters Buttons
  const resetBtn = document.getElementById('reset-filters-btn');
  const resetEmptyBtn = document.getElementById('reset-search-empty-btn');

  const doReset = () => {
    playSound('click');
    currentCategory = 'all';
    currentSearch = '';
    currentPerm = 'all';
    currentType = 'all';
    currentSort = 'default';

    if (searchInput) {
      searchInput.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
    }
    if (permFilter) permFilter.value = 'all';
    if (typeFilter) typeFilter.value = 'all';
    if (sortSelect) sortSelect.value = 'default';

    document.querySelectorAll('.cat-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.category === 'all');
    });

    renderCommands();
  };

  if (resetBtn) resetBtn.addEventListener('click', doReset);
  if (resetEmptyBtn) resetEmptyBtn.addEventListener('click', doReset);

  // Quick Copy Prefix Button
  const prefixBtn = document.getElementById('quick-copy-prefix');
  if (prefixBtn) {
    prefixBtn.addEventListener('click', () => {
      const currentPref = (typeof BOT_CONFIG !== 'undefined' && BOT_CONFIG.prefix) || '.';
      copyText(currentPref, `Đã sao chép Prefix mặc định (${currentPref})`);
    });
  }

  // Sound Toggle Button
  const soundBtn = document.getElementById('sound-toggle-btn');
  const soundIcon = document.getElementById('sound-icon');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundIcon) soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
      showToast(soundEnabled ? 'Đã bật hiệu ứng âm thanh' : 'Đã tắt hiệu ứng âm thanh', soundEnabled ? '🔊' : '🔇');
    });
  }

  // Snowfall Toggle Button
  const snowBtn = document.getElementById('snow-toggle-btn');
  const snowIcon = document.getElementById('snow-icon');
  if (snowBtn) {
    snowBtn.addEventListener('click', () => {
      if (window.snowEffectInstance) {
        const isEnabled = window.snowEffectInstance.toggle();
        snowBtn.classList.toggle('snow-disabled', !isEnabled);
        if (snowIcon) snowIcon.style.opacity = isEnabled ? '1' : '0.4';
        showToast(isEnabled ? 'Đã bật hiệu ứng bông tuyết rơi' : 'Đã tắt hiệu ứng bông tuyết', '❄️');
      }
    });
  }

  // Modal Close Buttons
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalFooterClose = document.getElementById('modal-close-footer-btn');
  const modalBackdrop = document.getElementById('command-modal');

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeCommandModal);
  if (modalFooterClose) modalFooterClose.addEventListener('click', closeCommandModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeCommandModal();
      }
    });
  }

  // Modal Syntax Copy buttons
  const copyPref = document.getElementById('modal-copy-prefix-btn');
  const copySlash = document.getElementById('modal-copy-slash-btn');
  if (copyPref) {
    copyPref.addEventListener('click', () => {
      if (activeModalCmd) {
        copyText(activeModalCmd.prefix_syntax, `Đã sao chép: ${activeModalCmd.prefix_syntax}`);
      }
    });
  }
  if (copySlash) {
    copySlash.addEventListener('click', () => {
      if (activeModalCmd) {
        copyText(activeModalCmd.slash_syntax, `Đã sao chép: ${activeModalCmd.slash_syntax}`);
      }
    });
  }

  // Code Block Copy buttons in Deployment Guide
  document.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      if (text) {
        copyText(text, 'Đã sao chép câu lệnh vào bộ nhớ tạm!');
      }
    });
  });
}

// ==========================================================================
// 8. SNOWFALL PARTICLES ENGINE (Hiệu Ứng Bông Tuyết Rơi Nghệ Thuật)
// ==========================================================================
class SnowEffect {
  constructor() {
    this.canvas = document.getElementById('snow-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animId = null;
    this.isRunning = false;
    this.mouse = { x: -1000, y: -1000, active: false };

    // Check user preference in localStorage (default is ON)
    const saved = localStorage.getItem('shin_snow_enabled');
    this.enabled = saved === null ? true : saved === 'true';

    this.colors = [
      '255, 255, 255',      // Pure white frost
      '220, 242, 255',      // Ice blue
      '225, 215, 255'       // Soft lilac tint (Nouridio purple theme)
    ];

    this.resizeCanvas();
    this.initParticles();
    this.setupListeners();

    if (this.enabled) {
      this.start();
    } else {
      this.canvas.classList.add('snow-hidden');
      const snowBtn = document.getElementById('snow-toggle-btn');
      if (snowBtn) snowBtn.classList.add('snow-disabled');
    }
  }

  resizeCanvas() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
  }

  initParticles() {
    // Dynamic density: ~40 on small screens, up to 90 on large monitors
    const count = Math.min(95, Math.max(40, Math.floor(this.width / 18)));
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomY = false) {
    const typeRoll = Math.random();
    let type = 'circle';
    let radius = 1.2 + Math.random() * 2.6;

    if (typeRoll > 0.82) {
      type = 'crystal'; // Detailed 6-branch snowflake
      radius = 4.0 + Math.random() * 3.5;
    } else if (typeRoll > 0.68) {
      type = 'sparkle'; // 4-pointed shimmering star
      radius = 2.4 + Math.random() * 2.2;
    }

    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    // Fall speed corresponds with size for natural depth & parallax
    const speedY = 0.65 + (radius / 6) * 1.5 + Math.random() * 0.4;
    const speedX = (Math.random() - 0.5) * 0.4;

    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : -15 - Math.random() * 20,
      radius,
      type,
      color,
      speedY,
      speedX,
      swingAmp: 10 + Math.random() * 22,
      swingSpeed: 0.012 + Math.random() * 0.02,
      swingAngle: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.025,
      sparklePhase: Math.random() * Math.PI * 2,
      sparkleSpeed: 0.03 + Math.random() * 0.05,
      opacity: 0.35 + Math.random() * 0.5
    };
  }

  setupListeners() {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.resizeCanvas();
        this.initParticles();
      }, 150);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else if (this.enabled) {
        this.start();
      }
    });
  }

  drawCrystal(f, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    ctx.strokeStyle = `rgba(${f.color}, ${alpha * 0.85})`;
    ctx.lineWidth = Math.max(1, f.radius * 0.22);
    ctx.lineCap = 'round';
    const r = f.radius;

    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r);
      const bPos = r * 0.55;
      const bLen = r * 0.35;
      ctx.moveTo(0, -bPos);
      ctx.lineTo(-bLen, -bPos - bLen * 0.4);
      ctx.moveTo(0, -bPos);
      ctx.lineTo(bLen, -bPos - bLen * 0.4);
      ctx.stroke();
      ctx.rotate(Math.PI / 3);
    }
    ctx.restore();
  }

  drawSparkle(f, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    const sparkAlpha = alpha * (0.6 + 0.4 * Math.sin(f.sparklePhase));
    ctx.fillStyle = `rgba(${f.color}, ${sparkAlpha})`;
    const sz = f.radius * 1.35;
    ctx.beginPath();
    ctx.moveTo(0, -sz);
    ctx.quadraticCurveTo(0, 0, sz, 0);
    ctx.quadraticCurveTo(0, 0, 0, sz);
    ctx.quadraticCurveTo(0, 0, -sz, 0);
    ctx.quadraticCurveTo(0, 0, 0, -sz);
    ctx.fill();
    ctx.restore();
  }

  drawCircle(f, alpha) {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 1.6);
    grad.addColorStop(0, `rgba(${f.color}, ${alpha})`);
    grad.addColorStop(0.5, `rgba(${f.color}, ${alpha * 0.55})`);
    grad.addColorStop(1, `rgba(${f.color}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.particles.length; i++) {
      const f = this.particles[i];

      // Physical Motion updates
      f.swingAngle += f.swingSpeed;
      f.sparklePhase += f.sparkleSpeed;
      f.rotation += f.rotSpeed;

      // Gentle swaying & falling
      f.x += Math.sin(f.swingAngle) * (f.swingAmp * 0.035) + f.speedX;
      f.y += f.speedY;

      // Interactive mouse breeze (subtle deflection around cursor)
      if (this.mouse.active) {
        const dx = f.x - this.mouse.x;
        const dy = f.y - this.mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 110 && dist > 0) {
          const force = (110 - dist) / 110 * 1.2;
          f.x += (dx / dist) * force;
          f.y += (dy / dist) * force * 0.5;
        }
      }

      // Draw particle according to type
      if (f.type === 'crystal') {
        this.drawCrystal(f, f.opacity);
      } else if (f.type === 'sparkle') {
        this.drawSparkle(f, f.opacity);
      } else {
        this.drawCircle(f, f.opacity);
      }

      // Wrap around bounds
      if (f.y > this.height + 20) {
        this.particles[i] = this.createParticle(false);
      } else if (f.x < -25) {
        f.x = this.width + 20;
      } else if (f.x > this.width + 25) {
        f.x = -20;
      }
    }

    if (this.isRunning) {
      this.animId = requestAnimationFrame(() => this.render());
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.canvas.classList.remove('snow-hidden');
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('shin_snow_enabled', this.enabled ? 'true' : 'false');
    if (this.enabled) {
      this.start();
    } else {
      this.canvas.classList.add('snow-hidden');
      setTimeout(() => {
        if (!this.enabled) this.stop();
      }, 500);
    }
    return this.enabled;
  }
}

function initSnowfall() {
  window.snowEffectInstance = new SnowEffect();
}

// ==========================================================================
// 9. CURSOR FOLLOWER & DIMINISHING TRAIL ENGINE (Hiệu Ứng Vòng Tròn Giảm Dần & Theo Sau)
// ==========================================================================
class CursorFollower {
  constructor() {
    this.dot = document.getElementById('cursor-dot');
    this.ring = document.getElementById('cursor-ring');
    this.canvas = document.getElementById('cursor-trail-canvas');
    if (!this.dot || !this.ring || !this.canvas) return;

    // Check touch devices
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    this.ctx = this.canvas.getContext('2d');
    this.mouseX = -100;
    this.mouseY = -100;
    this.lastX = -100;
    this.lastY = -100;
    this.ringX = -100;
    this.ringY = -100;
    this.isHovering = false;
    this.isClicking = false;
    this.hasMoved = false;

    this.particles = [];
    this.ripples = [];

    this.palette = [
      '173, 145, 255', // Shin violet
      '121, 131, 245', // Neon celestial blue
      '192, 132, 252', // Soft magic purple
      '224, 231, 255'  // Glowing starlight white
    ];

    this.resizeCanvas();
    this.setupEvents();
    this.animate();
  }

  resizeCanvas() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      if (!this.hasMoved) {
        this.hasMoved = true;
        this.ringX = this.mouseX;
        this.ringY = this.mouseY;
        this.lastX = this.mouseX;
        this.lastY = this.mouseY;
        this.dot.style.opacity = '1';
        this.ring.style.opacity = '1';
      }

      // Interpolate points between last and current mouse position for smooth trailing circles
      const dist = Math.hypot(this.mouseX - this.lastX, this.mouseY - this.lastY);
      const step = 10;
      if (dist >= step) {
        const count = Math.min(6, Math.floor(dist / step));
        for (let i = 1; i <= count; i++) {
          const t = i / count;
          const px = this.lastX + (this.mouseX - this.lastX) * t;
          const py = this.lastY + (this.mouseY - this.lastY) * t;

          this.particles.push({
            x: px,
            y: py,
            radius: 17 + Math.random() * 5,     // Bắt đầu vòng tròn từ 17 - 22px
            initialRadius: 21,
            shrinkSpeed: 0.65 + Math.random() * 0.3, // Thu nhỏ giảm dần mỗi frame
            colorIdx: Math.floor(Math.random() * this.palette.length),
            alpha: 0.8
          });
        }
        this.lastX = this.mouseX;
        this.lastY = this.mouseY;
      }
    });

    window.addEventListener('mousedown', (e) => {
      this.isClicking = true;
      this.ring.classList.add('cursor-click');

      // Click Ripple Shockwaves (Vòng tròn sóng bung tỏa)
      for (let i = 0; i < 2; i++) {
        this.ripples.push({
          x: e.clientX,
          y: e.clientY,
          radius: 8 + i * 6,
          maxRadius: 52 + i * 16,
          speed: 3.2 + i * 1.4,
          color: i === 0 ? '173, 145, 255' : '87, 242, 135',
          alpha: 0.95
        });
      }
    });

    window.addEventListener('mouseup', () => {
      this.isClicking = false;
      this.ring.classList.remove('cursor-click');
    });

    document.addEventListener('mouseleave', () => {
      this.dot.style.opacity = '0';
      this.ring.style.opacity = '0';
    });

    document.addEventListener('mouseenter', () => {
      if (this.hasMoved) {
        this.dot.style.opacity = '1';
        this.ring.style.opacity = '1';
      }
    });

    // Hover detection over interactive elements
    const interactiveSelectors = 'a, button, input, textarea, select, .btn, .nav-link, .gs-card, .faq-item, .cat-tab-btn, .cmd-row-card, .token-chip';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactiveSelectors)) {
        this.isHovering = true;
        this.ring.classList.add('cursor-hover');
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactiveSelectors)) {
        this.isHovering = false;
        this.ring.classList.remove('cursor-hover');
      }
    });
  }

  animate() {
    // 1. Smooth Follower Physics (Linear Interpolation)
    const lerpFactor = 0.16;
    this.ringX += (this.mouseX - this.ringX) * lerpFactor;
    this.ringY += (this.mouseY - this.ringY) * lerpFactor;

    if (this.hasMoved) {
      this.dot.style.transform = `translate3d(${this.mouseX}px, ${this.mouseY}px, 0) translate(-50%, -50%)`;
      this.ring.style.transform = `translate3d(${this.ringX}px, ${this.ringY}px, 0) translate(-50%, -50%)`;
    }

    // 2. Render Canvas: Trailing Diminishing Circles & Click Ripples
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Render & update diminishing circles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.radius -= p.shrinkSpeed;
      p.alpha = Math.max(0, (p.radius / p.initialRadius) * 0.8);

      if (p.radius <= 0.5 || p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Outer fading ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${this.palette[p.colorIdx]}, ${p.alpha})`;
      ctx.lineWidth = Math.max(1, p.radius * 0.14);
      ctx.stroke();

      // Soft core glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.palette[p.colorIdx]}, ${p.alpha * 0.28})`;
      ctx.fill();
    }

    // Render & update click ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed;
      r.alpha = Math.max(0, (1 - r.radius / r.maxRadius) * 0.95);

      if (r.radius >= r.maxRadius || r.alpha <= 0) {
        this.ripples.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r.color}, ${r.alpha})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    requestAnimationFrame(() => this.animate());
  }
}

function initCursorFollower() {
  window.cursorFollowerInstance = new CursorFollower();
}


