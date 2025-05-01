document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    const fileInput = document.getElementById('fileInput');
    
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/image/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json(); // 서버에서 온 응답을 JSON 형태로 파싱

        if (response.ok) {
            alert('파일 업로드 성공!');
            console.log(result);

            if (result.message && result.message === 'proxyuser') {
                alert('비로그인 사용자는 포인트가 지급되지 않습니다! 포인트는 home에서 확인 가능합니다.');
            } else {
                alert('포인트가 10 지급되었습니다. 포인트는 home에서 확인 가능합니다.');
            }
            
        } else {
            alert('파일 업로드 실패. 다시 시도해주세요.');
        }

    } catch (error) {
        console.error('파일 업로드 중 오류 발생:', error);
        alert('파일 업로드 중 오류가 발생했습니다.');
    }
});
