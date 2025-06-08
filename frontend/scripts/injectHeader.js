window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('header-container');

  try {
    const res = await fetch('header.html');
    const html = await res.text();
    container.innerHTML = html;

    // 헤더 삽입 완료 후 사용자 정보 동기화 및 관리자 메뉴 제어
    await syncUserInfoAndMenu();
  } catch (err) {
    console.error('헤더 로딩 실패:', err);
  }
});

async function syncUserInfoAndMenu() {
  const userPoints = document.getElementById('user-points');
  const userGrade = document.getElementById('user-grade');
  const userClass = document.getElementById('user-class');
  const userName = document.getElementById('user-name');
  const profileArea = document.getElementById('profile-area');
  const loginButton = document.getElementById('login-button');
  const createDatasetLink = document.getElementById('create-dataset-link');
  const homeLink = document.getElementById('home-link');

  if (!userPoints || !userName) return;

  try {
    const response = await fetch('/api/user-info');
    if (!response.ok) throw new Error('사용자 정보를 불러오지 못했습니다.');
    const data = await response.json();

    if (data.error || !data.name || data.name === "Guest") {
      profileArea.style.display = 'none';
      loginButton.style.display = 'block';
      if (createDatasetLink) createDatasetLink.style.display = 'none';
    } else {
      profileArea.style.display = 'block';
      loginButton.style.display = 'none';

      userName.textContent = `이름: ${data.name || 'N/A'}`;
      userPoints.textContent = `포인트: ${data.point ?? 'N/A'}`;
      userGrade.textContent = `등급: ${data.grade || 'N/A'}`;
      userClass.textContent = `클래스: ${data.class || 'N/A'}`;

      if (createDatasetLink) {
        if (data.class === 'MNG') {
          createDatasetLink.style.display = 'inline-block';
        } else {
          createDatasetLink.style.display = 'none';
        }
      }
      if (homeLink) {
        homeLink.style.display = 'inline-block';
      }
    }
  } catch (error) {
    console.error('사용자 정보 오류:', error);
    profileArea.style.display = 'none';
    loginButton.style.display = 'block';
    userName.textContent = '이름: -';
    userPoints.textContent = '포인트: -';
    userGrade.textContent = '등급: -';
    userClass.textContent = '클래스: -';
    if (createDatasetLink) createDatasetLink.style.display = 'none';
    if (homeLink) homeLink.style.display = 'inline-block';
  }
}

function logout() {
  fetch('/api/logout', { method: 'POST' })
    .then(() => window.location.reload())
    .catch(err => {
      console.error('로그아웃 실패:', err);
      alert('로그아웃 중 문제가 발생했습니다.');
    });
}
