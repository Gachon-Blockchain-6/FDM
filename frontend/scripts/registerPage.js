// 페이지가 로드되기 전에 실행되는 것을 방지.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('registerBtn').onclick = async function () {
        const data = {
            loginid: document.getElementById('loginid').value,
            password: document.getElementById('password').value,
            name: document.getElementById('name').value,
            address: document.getElementById('address').value,
            tel: document.getElementById('tel').value,
            birth: document.getElementById('birth').value,
        };

        // 입력값 검증
        for (const key in data) {
            if (!data[key]) {
                alert(`${key} 값을 입력해주세요.`);
                return;
            }
        }

        try {
            const response = await fetch('/api/auth/register_process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();
            if (result.success) {
                alert('회원가입 성공!');
                window.location.href = '/home.html';
            } else {
                alert('회원가입 실패: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('회원가입 중 문제가 발생했습니다.');
        }
    };
});
