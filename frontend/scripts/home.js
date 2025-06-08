document.addEventListener("DOMContentLoaded", async () => {
    const userPoints = document.getElementById('user-points');
    const userGrade = document.getElementById('user-grade');
    const userClass = document.getElementById('user-class');
    const userName = document.getElementById('user-name');
    const profileArea = document.getElementById('profile-area');
    const loginButton = document.getElementById('login-button');

    if (!userPoints || !userName) return;  // header.html이 없을 수도 있음

    try {
        const response = await fetch('/api/user-info');
        if (!response.ok) throw new Error('사용자 정보를 불러오지 못했습니다.');
        const data = await response.json();

        if (data.error || !data.name || data.name === "Guest") {
            profileArea.style.display = 'none';
            loginButton.style.display = 'block';
        } else {
            profileArea.style.display = 'block';
            loginButton.style.display = 'none';

            userName.textContent = `이름: ${data.name || 'N/A'}`;
            userPoints.textContent = `포인트: ${data.point ?? 'N/A'}`;
            userGrade.textContent = `등급: ${data.grade || 'N/A'}`;
            userClass.textContent = `클래스: ${data.class || 'N/A'}`;
        }
    } catch (error) {
        console.error('사용자 정보 오류:', error);
        profileArea.style.display = 'none';
        loginButton.style.display = 'block';
        userName.textContent = '이름: -';
        userPoints.textContent = '포인트: -';
        userGrade.textContent = '등급: -';
        userClass.textContent = '클래스: -';
    }
});

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => window.location.reload())
        .catch(err => {
            console.error('로그아웃 실패:', err);
            alert('로그아웃 중 문제가 발생했습니다.');
        });
}
