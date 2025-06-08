window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('header-container');
  const res = await fetch('header.html');
  const html = await res.text();
  container.innerHTML = html;

  handleAuthUI(); // 헤더 삽입 후 로그인 UI 조절
});

function handleAuthUI() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  const profile = document.getElementById("profile-area");
  const login = document.getElementById("login-button");

  if (isLoggedIn) {
    if (profile) profile.style.display = "block";
    if (login) login.style.display = "none";
  } else {
    if (profile) profile.style.display = "none";
    if (login) login.style.display = "block";
  }
}

function logout() {
  localStorage.removeItem('isLoggedIn');  // 상태 제거
  handleAuthUI();                         // UI 업데이트
}

