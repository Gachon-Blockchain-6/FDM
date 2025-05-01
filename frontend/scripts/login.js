// 페이지가 로드되기 전에 실행되는 것을 방지.
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 버튼 클릭 이벤트
    document.getElementById('loginBtn').onclick = async function () {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            alert('ID와 비밀번호를 입력해주세요.');
            return;
        }

        try {
            const response = await fetch('/api/auth/login_process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ loginid: username, password }),
            });

            const result = await response.json();
            if (result.success) {
                alert('로그인 성공!');
                window.location.href = '/home.html';
            } else {
                alert('로그인 실패: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('로그인 중 문제가 발생했습니다.');
        }
    };

    // 프록시 로그인 버튼 클릭 이벤트
    document.getElementById('proxyBtn').onclick = async function () {
        try {
            const response = await fetch('/api/auth/proxy_login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();
            if (result.success) {
                alert('임시 계정으로 로그인했습니다.');
                window.location.href = '/home.html';
            } else {
                alert('프록시 로그인 실패: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('프록시 로그인 중 문제가 발생했습니다.');
        }
    };
});
