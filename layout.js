/* layout.js — shared by every page. */
(function () {
  /* ---------- 1. SIDEBAR ---------- */
  const page = location.pathname.split('/').pop() || 'dashboard.html';

  const links = [
    { href: 'dashboard.html',       icon: '▦',  label: 'Dashboard' },
    { href: 'discuss.html',         icon: '💬', label: 'Discuss' },
    { 
      href: 'subscription.html',    icon: '🎫', label: 'Subscription', hasDropdown: true,
      subItems: [
        { label: 'All Products',    href: 'subscription.html#all' },
        { label: 'Starter Plan',    href: 'subscription.html#starter' },
        { label: 'Pro Plan',        href: 'subscription.html#pro' }
      ]
    },
    { 
      href: 'paymentapproval.html', icon: '💳', label: 'Payment Approval', hasDropdown: true,
      subItems: [
        { label: 'All Approvals',    href: 'paymentapproval.html#all' },
        { label: 'Refunds Queue',    href: 'paymentapproval.html#refunds' },
        { label: 'Discounts Tab',    href: 'paymentapproval.html#discounts' }
      ]
    },
    { 
      href: 'email-marketing.html', icon: '✉️', label: 'Email Marketing', hasDropdown: true,
      subItems: [
        { label: 'All Campaigns',   href: 'email-marketing.html#all' },
        { label: 'Create Campaign', href: 'email-marketing.html#new' },
        { label: 'Sent Campaigns',  href: 'email-marketing.html#sent' }
      ]
    },
    { href: 'staff.html',           icon: '👥', label: 'Staff Dashboard' },
    { href: 'settings.html',        icon: '⚙️', label: 'Settings' },
  ];

  const base   = 'flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors';
  const idle   = base + ' text-slate-300 hover:bg-white/10';
  const active = base + ' bg-indigo-500/20 font-semibold text-white border-l-4 border-indigo-500';

  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <a href="dashboard.html" class="flex items-center gap-3 text-xl font-bold mb-2">
      <span class="text-3xl text-blue-500">∞</span> <span id="sidebarBrandName">${localStorage.getItem('bl_platformName') || 'Brightloop'}</span>
    </a>

    <div class="mt-4 flex items-center gap-2 rounded-lg bg-[#1a2954] px-3 py-2 text-sm text-slate-400 border border-white/5 shadow-inner">
      🔍 <input id="sidebarSearch" type="text" placeholder="Search" class="bg-transparent outline-none w-full text-white placeholder-slate-400" />
    </div>

    <nav id="sidebarNav" class="mt-6 flex flex-col gap-1 text-sm">
      ${links.map((l, idx) => `
        <div class="nav-group" data-label="${l.label.toLowerCase()}">
          <div class="flex items-center">
            <a href="${l.href}" class="flex-1 ${l.href === page ? active : idle}">
              <div class="flex items-center gap-3">
                <span>${l.icon}</span> <span>${l.label}</span>
              </div>
              ${l.hasDropdown ? `<span data-dropdown-toggle="sub-${idx}" class="text-xs text-slate-400 px-1.5 py-0.5 rounded hover:bg-white/10">˅</span>` : ''}
            </a>
          </div>
          ${l.hasDropdown ? `
            <div id="sub-${idx}" class="${l.href === page ? '' : 'hidden'} pl-9 pr-2 py-1 flex flex-col gap-1 text-xs text-slate-400">
              ${l.subItems.map(s => `<a href="${s.href}" class="py-1.5 px-2 rounded hover:text-white hover:bg-white/5 transition-colors">${s.label}</a>`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </nav>

    <a id="logout" href="dashboard.html" class="${idle} mt-auto text-sm justify-start gap-3">
      ⎋ <span>Log out</span>
    </a>

    <div class="mt-4 flex items-center justify-center gap-3 text-sm">
      <span class="text-slate-400">Light</span>
      <button id="themeToggle" aria-label="Toggle dark mode"
              class="flex h-7 w-12 items-center justify-start rounded-full bg-indigo-500 p-1 transition-all duration-300">
        <span class="h-5 w-5 rounded-full bg-white shadow-md"></span>
      </button>
      <span class="text-slate-100">Dark</span>
    </div>
  `;

  // Sub-menu dropdown toggle
  sidebar.querySelectorAll('[data-dropdown-toggle]').forEach(chevron => {
    chevron.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = document.getElementById(chevron.dataset.dropdownToggle);
      if (target) target.classList.toggle('hidden');
    });
  });

  // Sidebar live search filter (also navigates on Enter)
  const searchInput = document.getElementById('sidebarSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      sidebar.querySelectorAll('.nav-group').forEach(group => {
        group.style.display = group.dataset.label.includes(q) ? '' : 'none';
      });
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const firstVisible = Array.from(sidebar.querySelectorAll('.nav-group')).find(g => g.style.display !== 'none');
        const link = firstVisible ? firstVisible.querySelector('a') : null;
        if (link) location.href = link.getAttribute('href');
      }
    });
  }

  // Since login.html is removed, clicking Log out resets session state and returns to dashboard.html
  document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Reset current session data and return to Dashboard?')) {
      sessionStorage.clear();
      location.href = 'dashboard.html';
    }
  });

  /* ---------- 2. DARK MODE (remembered) ---------- */
  const toggle = document.getElementById('themeToggle');

  function setDark(on) {
    document.documentElement.classList.toggle('dark', on);
    toggle.classList.toggle('justify-end', on);
    toggle.classList.toggle('justify-start', !on);
    try { localStorage.setItem('theme', on ? 'dark' : 'light'); } catch (e) {}
  }

  toggle.addEventListener('click', () => {
    setDark(!document.documentElement.classList.contains('dark'));
  });

  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  setDark(saved === 'dark');

  /* ---------- 3. PHONE MENU (hamburger) ---------- */
  const overlay = document.getElementById('overlay');
  const menuBtn = document.getElementById('menuBtn');
  const openClasses = ['fixed', 'inset-y-0', 'left-0', 'z-30', 'flex'];

  function setSidebar(open) {
    sidebar.classList.toggle('hidden', !open);
    openClasses.forEach(c => sidebar.classList.toggle(c, open));
    if (overlay) overlay.classList.toggle('hidden', !open);
  }

  if (menuBtn) menuBtn.addEventListener('click', () => setSidebar(true));
  if (overlay) overlay.addEventListener('click', () => setSidebar(false));
})();