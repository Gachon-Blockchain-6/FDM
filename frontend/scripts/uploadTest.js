document.addEventListener('DOMContentLoaded', async () => {
    const datasetContainer = document.getElementById('dataset-container');
    const uploadForm = document.getElementById('uploadForm');

    // 데이터셋 목록을 불러와 체크박스로 표시
    try {
        const response = await fetch('/api/label/datasetinfo');
        const data = await response.json();

        if (data.success && data.datasets.length > 0) {
            datasetContainer.innerHTML = ''; // "불러오는 중" 메시지 제거
            data.datasets.forEach(dataset => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <input type="checkbox" id="dataset-${dataset.dataset_id}" name="dataset_ids" value="${dataset.dataset_id}">
                    <label for="dataset-${dataset.dataset_id}">${dataset.name}</label>
                `;
                datasetContainer.appendChild(div);
            });
        } else {
            datasetContainer.innerHTML = '<p>데이터셋을 불러올 수 없거나 생성된 데이터셋이 없습니다.</p>';
        }
    } catch (error) {
        console.error('Error fetching datasets:', error);
        datasetContainer.innerHTML = '<p>데이터셋을 불러오는 중 오류가 발생했습니다.</p>';
    }

    // 폼 제출 이벤트 핸들러
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        const fileInput = document.getElementById('fileInput');
        const selectedCheckboxes = document.querySelectorAll('input[name="dataset_ids"]:checked');

        if (selectedCheckboxes.length === 0) {
            alert('하나 이상의 데이터셋을 선택해야 합니다.');
            return;
        }

        if (!fileInput.files || fileInput.files.length === 0) {
            alert('업로드할 파일을 선택해주세요.');
            return;
        }

        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
        
        formData.append('file', fileInput.files[0]);
        formData.append('dataset_ids', selectedIds.join(',')); // 쉼표로 구분된 문자열로 전송
        
        try {
            const response = await fetch('/api/image/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();

            if (response.ok) {
                alert('파일 업로드 및 라벨 정보 저장을 완료했습니다!');
                console.log(result);

                if (result.message && result.message === 'proxyuser') {
                    alert('비로그인 사용자는 포인트가 지급되지 않습니다.');
                } else if (result.message === 'normaluser') {
                    alert('포인트가 10 지급되었습니다. 포인트는 home에서 확인 가능합니다.');
                }
                
                // 폼 초기화
                uploadForm.reset();
                selectedCheckboxes.forEach(cb => cb.checked = false);

            } else {
                alert(result.message || '파일 업로드 실패. 다시 시도해주세요.');
            }

        } catch (error) {
            console.error('파일 업로드 중 오류 발생:', error);
            alert('파일 업로드 중 오류가 발생했습니다.');
        }
    });
});
