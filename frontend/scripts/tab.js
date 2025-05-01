document.addEventListener("DOMContentLoaded", async () => {
    // 탭 버튼과 탭 컨테이너에 대한 참조
    const tabButton = document.getElementById("tabButton");
    const tabContainer = document.getElementById("tabContainer");
    const authButton = document.getElementById('authButton');

    // 탭 버튼 클릭 시 탭 열기/닫기 처리
    tabButton.addEventListener("click", () => {
        const isOpen = tabContainer.classList.toggle("open");
        document.body.classList.toggle("tab-open", isOpen);
    });

    // 로그인/로그아웃 버튼 상태 처리
    try {
        // 사용자 정보 조회 요청
        const response = await fetch('/api/user-info');
        if (!response.ok) {
            throw new Error('사용자 정보를 불러오지 못했습니다.');
        }

        const data = await response.json();
        if (data.error || data.loginid === 'Guest') {
            // 로그인이 되어 있지 않다면 로그인 버튼 보이기
            authButton.textContent = '로그인';
            authButton.addEventListener('click', () => {
                window.location.href = '/loginPage.html'; // 로그인 페이지로 이동
            });
        } else {
            // 로그인이 되어 있다면 로그아웃 버튼으로 변경
            authButton.textContent = '로그아웃';
            authButton.addEventListener('click', async () => {
                try {
                    const logoutResponse = await fetch('/api/auth/logout_process', {
                        method: 'GET',  // 로그아웃은 POST 요청으로 변경
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (logoutResponse.ok) {
                        alert('로그아웃 되었습니다.');
                        window.location.href = '/index.html'; // 로그아웃 후 리다이렉트
                    } else {
                        alert('로그아웃에 실패했습니다. 다시 시도해 주세요.');
                    }
                } catch (error) {
                    console.error('로그아웃 요청 중 오류 발생:', error);
                    alert('로그아웃 요청 중 오류가 발생했습니다.');
                }
            });
        }
    } catch (error) {
        console.error('사용자 정보 로딩 오류:', error);
    }
});
