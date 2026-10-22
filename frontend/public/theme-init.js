// Applies the saved theme before the app loads, so there's no flash of the wrong theme.
try {
  if (localStorage.getItem('theme') === 'light') document.documentElement.classList.remove('dark')
} catch {
  // storage unavailable
}
