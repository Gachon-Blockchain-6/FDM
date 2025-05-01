document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const boardId = urlParams.get('boardId'); // URL에서 boardId 추출
    const form = document.getElementById('createForm');
    const titleInput = form.querySelector('input[name="title"]');
    const writerInput = form.querySelector('input[name="writer"]');
    const contentTextarea = form.querySelector('textarea[name="content"]');
    const passwordInput = form.querySelector('input[name="password"]');

    if (!boardId) {
        alert("잘못된 접근입니다. 게시글 ID가 없습니다.");
        location.href = '/boardView.html';
        return;
    }

    // Hidden input으로 boardId를 form에 추가
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'boardId';
    hiddenInput.value = boardId;
    form.appendChild(hiddenInput);

    try {
        // API 호출로 기존 게시글 데이터 가져오기
        const response = await fetch(`/api/board/detail/${boardId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Fetched board data:", data);

        // 기존 데이터로 폼 채우기
        titleInput.value = data.title || '';
        writerInput.value = data.writer || '';
        contentTextarea.value = data.content || '';
    } catch (error) {
        console.error("Error fetching board details:", error);
        alert("게시글 데이터를 불러오는 데 실패했습니다.");
    }

    // 폼 제출 이벤트 처리
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // 폼 기본 제출 동작 방지

        const title = titleInput.value.trim();
        const content = contentTextarea.value.trim();
        const password = passwordInput.value.trim();

        if (!title || !content || !password) {
            alert("모든 필드를 입력해야 합니다.");
            return;
        }

        try {
            // API 호출로 수정 요청 전송
            const response = await fetch('/api/board/update_process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    boardId,
                    title,
                    content,
                    password,
                }),
            });

            if (response.ok) {
                alert("게시글이 성공적으로 수정되었습니다.");
                location.href = `/boardDetail.html?boardId=${boardId}`;
            } else {
                const errorMessage = await response.text();
                alert(errorMessage || "게시글 수정 중 문제가 발생했습니다.");
            }
        } catch (error) {
            console.error("Error updating board:", error);
            alert("게시글 수정 중 오류가 발생했습니다.");
        }
    });
});
