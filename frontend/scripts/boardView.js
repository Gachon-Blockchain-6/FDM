document.addEventListener('DOMContentLoaded', async () => {
    const boardsContainer = document.getElementById('boards');
    const writeButtonContainer = document.querySelector('.write-button');
    const paginationContainer = document.querySelector('.pagination');

    try {
        // 게시판 데이터 가져오기
        const response = await fetch('/api/board/view');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const { boards, cls, pNum, totalPages } = data;

        // 응답 데이터 콘솔 출력
        console.log("Fetched boards data:", boards);
        console.log("User class:", cls);
        console.log("Current page:", pNum);
        console.log("Total pages:", totalPages);

        // 게시글 목록 표시
        if (!boards || boards.length === 0) {
            boardsContainer.innerHTML = '<p>게시글이 없습니다. 글을 작성해 보세요!</p>';
        } else {
            boardsContainer.innerHTML = '';
            boards.forEach(board => {
                const boardItem = document.createElement('div');
                boardItem.classList.add('board-item');
                boardItem.innerHTML = `
                    <h2><a href="/boardDetail.html?boardId=${board.board_id}">${board.title}</a></h2>
                    <p>작성자: ${board.name} | 작성일: ${board.date}</p>
                `;
                boardsContainer.appendChild(boardItem);
            });
        }

        // 글 작성 버튼 추가 (조건부)
        if (writeButtonContainer) {
            writeButtonContainer.innerHTML = ''; // 기존 버튼 제거
            if (cls === 'CST' || cls === 'MNG') {
                const writeButton = document.createElement('a');
                writeButton.href = '/boardCreate.html';
                writeButton.classList.add('btn');
                writeButton.innerText = '글 작성하기';
                writeButtonContainer.appendChild(writeButton);
            }
        }

        // 페이지네이션 표시
        if (paginationContainer) {
            paginationContainer.innerHTML = ''; // 기존 페이지네이션 제거
            for (let j = 1; j <= totalPages; j++) {
                const pageSpan = document.createElement('span');
                if (j === pNum) {
                    pageSpan.style.fontWeight = 'bold';
                    pageSpan.innerText = j;
                } else {
                    const pageLink = document.createElement('a');
                    pageLink.href = `/board/view/3/${j}`;
                    pageLink.innerText = j;
                    pageSpan.appendChild(pageLink);
                }
                paginationContainer.appendChild(pageSpan);
                paginationContainer.appendChild(document.createTextNode(' '));
            }
        }
    } catch (error) {
        console.error("Error fetching board data:", error);
        if (boardsContainer) {
            boardsContainer.innerHTML = '<p>게시글을 불러오는 데 실패했습니다.</p>';
        }
    }
});
