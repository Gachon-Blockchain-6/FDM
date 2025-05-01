document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const boardId = urlParams.get('boardId');
    const titleInput = document.querySelector('input[name="title"]');
    const writerInput = document.querySelector('#writer');
    const contentTextarea = document.querySelector('textarea[name="content"]');
    const dateInput = document.querySelector('input[name="date"]');
    const passwordInput = document.querySelector('#password'); // 비밀번호 입력 필드
    const buttonContainer = document.querySelector('.d-grid.gap-2');

    if (!boardId) {
        alert("잘못된 접근입니다. 게시글 ID가 없습니다.");
        location.href = '/boardView.html';
        return;
    }

    try {
        // API 호출로 게시글 데이터 가져오기
        const response = await fetch(`/api/board/detail/${boardId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Fetched board detail:", data);

        // 가져온 데이터로 폼 채우기
        titleInput.value = data.title || '제목 없음';
        writerInput.value = data.writer || '작성자 없음';
        contentTextarea.value = data.content || '내용 없음';
        dateInput.value = data.date || '작성일 없음';

        // 수정/삭제 버튼 추가
        buttonContainer.innerHTML = ''; // 기존 버튼 제거

        // 내가 작성한 게시글이거나 관리자가 보는 경우 수정/삭제 버튼 추가
        if (data.isOwner || data.cls === 'MNG') {
            // 수정 버튼
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.classList.add('btn', 'btn-warning');
            editButton.innerText = '수정';
            editButton.onclick = async () => {
                const password = passwordInput.value.trim(); // 비밀번호 입력 필드에서 값 가져오기
                if (data.cls === 'MNG') {
                    // 관리자일 경우 바로 수정 화면으로 이동
                    location.href = `/boardUpdate.html?boardId=${boardId}`;
                    return;
                }
                
                if (!password) {
                    alert("비밀번호를 입력하세요.");
                    return;
                }



                try {
                    // 비밀번호와 boardId를 포함한 수정 요청
                    const response = await fetch(`/api/update`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ boardId, password }),
                    });

                    if (response.ok) {
                        alert("수정 화면으로 이동합니다.");
                        location.href = `/boardEdit.html?boardId=${boardId}`;
                    } else {
                        const errorMessage = await response.text();
                        alert(errorMessage || "비밀번호가 일치하지 않습니다.");
                    }
                } catch (error) {
                    console.error("Error during update request:", error);
                    alert("수정 요청 중 오류가 발생했습니다.");
                }
            };

            // 삭제 버튼 (로직 그대로 유지)
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.classList.add('btn', 'btn-danger');
            deleteButton.innerText = '삭제';
            deleteButton.onclick = async () => {
                if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
                    try {
                        const deleteResponse = await fetch(`/api/board/delete/${boardId}`, {
                            method: 'POST',
                        });
                        if (!deleteResponse.ok) {
                            throw new Error('삭제에 실패했습니다.');
                        }
                        alert('게시글이 삭제되었습니다.');
                        location.href = '/boardView.html';
                    } catch (error) {
                        console.error('Error deleting board:', error);
                        alert('게시글 삭제 중 오류가 발생했습니다.');
                    }
                }
            };

            // 버튼 추가
            buttonContainer.appendChild(editButton);
            buttonContainer.appendChild(deleteButton);
        }
    } catch (error) {
        console.error("Error fetching board details:", error);
        alert("게시글 데이터를 불러오는 데 실패했습니다.");
    }
});
