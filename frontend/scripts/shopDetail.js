document.addEventListener('DOMContentLoaded', () => {
    const datasetDetailContainer = document.getElementById('dataset-detail-content');
    const purchaseButton = document.getElementById('purchase-button');
    const downloadButton = document.getElementById('download-button');
    const purchaseStatusDiv = document.getElementById('purchase-status');
    const params = new URLSearchParams(window.location.search);
    const datasetId = params.get('id');

    if (!datasetDetailContainer || !purchaseButton || !downloadButton || !purchaseStatusDiv) {
        console.error('Required page elements not found!');
        if (datasetDetailContainer) datasetDetailContainer.innerHTML = '<p>페이지 구성 오류가 발생했습니다.</p>';
        return;
    }

    if (!datasetId) {
        datasetDetailContainer.innerHTML = '<p>데이터셋 ID가 제공되지 않았습니다. 목록으로 돌아가 다시 시도해주세요.</p>';
        console.error('Dataset ID not found in URL parameters');
        return;
    }

    // 백엔드 API에서 특정 데이터셋 정보 가져오기
    fetch(`/api/label/dataset/all/${datasetId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.data) {
                const dataset = data.data;
                // 상세 정보를 HTML로 구성하여 표시
                datasetDetailContainer.innerHTML = `
                    <h3>${dataset.name}</h3>
                    <p><strong>설명:</strong> ${dataset.content || '정보 없음'}</p>
                    <p><strong>가격:</strong> ${dataset.price !== undefined ? dataset.price.toLocaleString() + ' KRW' : '가격 정보 없음'}</p>
                    <p><strong>라벨링 질문:</strong> ${dataset.question || '정보 없음'}</p>
                    `;
                
                // 구매 여부에 따라 버튼 표시 결정
                if (dataset.isPurchased) {
                    purchaseButton.style.display = 'none';
                    downloadButton.style.display = 'block';
                    purchaseStatusDiv.innerHTML = '<p style="color: blue;">이미 구매한 데이터셋입니다. 다운로드할 수 있습니다.</p>';
                } else {
                    purchaseButton.style.display = 'block';
                    downloadButton.style.display = 'none';
                }
            } else {
                console.error('Failed to load dataset details:', data.message);
                datasetDetailContainer.innerHTML = `<p>데이터 상세 정보를 불러오는 데 실패했습니다: ${data.message || '알 수 없는 오류'}</p>`;
            }
        })
        .catch(error => {
            console.error('Error fetching dataset details:', error);
            datasetDetailContainer.innerHTML = `<p>데이터 상세 정보 로딩 중 오류 발생: ${error.message}</p>`;
        });

    // 구매 버튼 클릭 이벤트 리스너
    purchaseButton.addEventListener('click', () => {
        purchaseStatusDiv.innerHTML = '구매 처리 중...';
        purchaseButton.disabled = true;

        fetch('/api/label/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 필요하다면 인증 토큰 등을 헤더에 추가합니다.
                // 'Authorization': 'Bearer ' + YOUR_AUTH_TOKEN
            },
            body: JSON.stringify({ dataset_id: datasetId }) // 서버에서 dataset_id로 받을 것으로 예상
        })
        .then(response => response.json()) // 응답을 JSON으로 파싱
        .then(data => {
            if (data.success) {
                purchaseStatusDiv.innerHTML = `<p style="color: green;">구매가 성공적으로 완료되었습니다. ${data.message || ''}</p>`;
                purchaseButton.style.display = 'none'; // 구매 성공 시 버튼 숨김
                downloadButton.style.display = 'block'; // 다운로드 버튼 표시
            } else {
                purchaseStatusDiv.innerHTML = `<p style="color: red;">구매 실패: ${data.message || '알 수 없는 오류가 발생했습니다.'}</p>`;
                purchaseButton.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error during purchase:', error);
            purchaseStatusDiv.innerHTML = `<p style="color: red;">구매 요청 중 오류 발생: ${error.message}</p>`;
            purchaseButton.disabled = false;
        });
    });

    // 다운로드 버튼 클릭 이벤트 리스너 (실제 다운로드 로직은 추후 구현)
    downloadButton.addEventListener('click', () => {
        // TODO: 실제 다운로드 로직 구현 필요
        // 예: window.location.href = `/api/label/download/${datasetId}`;
        purchaseStatusDiv.innerHTML = '<p style="color: blue;">다운로드 기능은 현재 준비 중입니다.</p>';
        console.log('Download button clicked for dataset ID:', datasetId);
    });
});