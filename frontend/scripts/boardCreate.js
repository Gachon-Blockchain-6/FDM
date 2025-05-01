document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('createForm');
    const writerInput = document.getElementById('writer');

    try {
        // 서버에서 사용자 정보 가져오기
        const response = await fetch('/api/board/create');
        if (!response.ok) {
            throw new Error('사용자 정보를 불러오는 데 실패했습니다.');
        }

        const { name, loginid, type_id } = await response.json();

        // 작성자 정보 표시
        writerInput.value = name;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 폼의 데이터를 객체로 생성
            const formData = {
                loginid: loginid,
                typeid: type_id,
                title: form.elements['title'].value,
                content: form.elements['content'].value,
                password: form.elements['password'].value
            };

            try {
                const response = await fetch('/api/board/create_process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    alert('게시글이 성공적으로 생성되었습니다.');
                    window.location.href = `/boardView.html`;
                } else {
                    alert('게시글 생성에 실패했습니다. 다시 시도해주세요.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('게시글 생성 중 오류가 발생했습니다.');
            }
        });
    } catch (error) {
        console.error(error);
        alert('작성자 정보를 불러오는 데 실패했습니다.');
    }
});
