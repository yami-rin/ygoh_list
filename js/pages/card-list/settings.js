import { applyTheme, getTheme } from '../../shared/theme.js';

export function applyCardListTheme(darkModeToggle) {
    const savedTheme = applyTheme(getTheme());
    darkModeToggle.checked = savedTheme === 'dark';

    const nav = document.querySelector('.navbar');
    if (nav) {
        nav.setAttribute('data-bs-theme', savedTheme);
        if (savedTheme === 'dark') {
            nav.classList.remove('navbar-light', 'bg-light');
            nav.classList.add('navbar-dark', 'bg-dark');
        } else {
            nav.classList.remove('navbar-dark', 'bg-dark');
            nav.classList.add('navbar-light', 'bg-light');
        }
    }
}
