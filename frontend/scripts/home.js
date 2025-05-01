document.addEventListener("DOMContentLoaded", async () => {
    const userPoints = document.getElementById('user-points');
    const userGrade = document.getElementById('user-grade');
    const userClass = document.getElementById('user-class');
    const userName = document.getElementById('user-name');

    try {
        // 사용자 정보 조회 요청
        const response = await fetch('/api/user-info');

        if (!response.ok) {
            throw new Error('사용자 정보를 불러오지 못했습니다.');
        }

        const data = await response.json();
        console.log(data);

        // 데이터가 존재하고, 이름이 "Guest"인 경우에도 사용자 정보를 표시하도록 수정
        if (data.error) {
            // 오류가 있을 경우 기본 값을 설정
            userName.textContent = '이름: -';
            userPoints.textContent = '포인트: -';
            userGrade.textContent = '등급: -';
            userClass.textContent = '클래스: -';
        } else {
            // 사용자 정보를 UI에 표시
            userName.textContent = `이름: ${data.name || 'N/A'}`;
            userPoints.textContent = `포인트: ${data.point !== undefined ? data.point : 'N/A'}`;
            userGrade.textContent = `등급: ${data.grade || 'N/A'}`;
            userClass.textContent = `클래스: ${data.class || 'N/A'}`;
        }
    } catch (error) {
        console.error('사용자 정보 오류:', error);
        // 오류 발생 시 기본 정보를 표시
        userName.textContent = '이름: -';
        userPoints.textContent = '포인트: -';
        userGrade.textContent = '등급: -';
        userClass.textContent = '클래스: -';
    }


});
