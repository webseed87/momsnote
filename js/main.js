document.addEventListener('DOMContentLoaded', () => {

  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  const breadcrumbActive = document.getElementById('breadcrumb-active');

  // ─── Sidebar toggle ───────────────────────────────
  function isMobile() {
    return window.innerWidth <= 768;
  }

  menuToggle.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    } else {
      sidebar.classList.toggle('hidden');
    }
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });

  // ─── Nav items ────────────────────────────────────
  const navItems = document.querySelectorAll('.nav-item');
  const subNavItems = document.querySelectorAll('.sub-nav-item');
  const sections = document.querySelectorAll('.section');

  function setActiveSection(sectionId, label) {
    sections.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    if (breadcrumbActive) breadcrumbActive.textContent = label;

    if (isMobile()) {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const hasSubnav = item.querySelector('.sub-nav');
      const sectionId = item.dataset.section;

      if (hasSubnav) {
        // toggle open/close
        navItems.forEach(i => {
          if (i !== item) {
            i.classList.remove('open');
          }
        });
        item.classList.toggle('open');
        e.stopPropagation();
        return;
      }

      navItems.forEach(i => i.classList.remove('active'));
      subNavItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      if (sectionId) {
        const label = item.querySelector('.nav-text')?.textContent || '';
        setActiveSection(sectionId, label);
      }
    });
  });

  subNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const sectionId = item.dataset.section;

      subNavItems.forEach(i => i.classList.remove('active'));
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      if (sectionId) {
        const label = item.textContent.trim();
        setActiveSection(sectionId, label);
      }
    });
  });

  // ─── Quick links ──────────────────────────────────
  document.querySelectorAll('.quick-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      const label = btn.querySelector('.ql-title')?.textContent || '';
      if (sectionId) {
        setActiveSection(sectionId, label);

        // update nav active state
        navItems.forEach(i => i.classList.remove('active'));
        subNavItems.forEach(i => i.classList.remove('active'));
        const navMatch = document.querySelector(`[data-section="${sectionId}"]`);
        if (navMatch) {
          navMatch.classList.add('active');
          const parent = navMatch.closest('.nav-item');
          if (parent) parent.classList.add('open');
        }
      }
    });
  });

  // ─── Week tabs ────────────────────────────────────
  document.querySelectorAll('.week-tabs').forEach(tabGroup => {
    const tabs = tabGroup.querySelectorAll('.week-tab');
    const container = tabGroup.closest('.week-tab-container');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (container) {
          const weekId = tab.dataset.week;
          container.querySelectorAll('.week-content').forEach(c => c.classList.remove('active'));
          const target = container.querySelector(`[data-week-content="${weekId}"]`);
          if (target) target.classList.add('active');
        }
      });
    });
  });

  // ─── Checkboxes ───────────────────────────────────
  document.querySelectorAll('.check-icon').forEach(icon => {
    icon.addEventListener('click', () => {
      icon.classList.toggle('done');
      const li = icon.closest('li');
      if (li) li.classList.toggle('done-item');
    });
  });

  // init: show home section
  setActiveSection('home', '홈');
});
