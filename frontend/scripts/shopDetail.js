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
                // 오류 응답을 JSON으로 파싱 시도 (백엔드에서 JSON 에러 메시지를 보낸 경우)
                return response.json().then(errData => {
                    throw new Error(errData.message || `HTTP error! status: ${response.status}`);
                }).catch(() => {
                    // JSON 파싱 실패 시 일반 HTTP 오류 throw
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
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
                
                // 구매 여부에 따라 버튼 표시 결정 (원래 로직)
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
        purchaseStatusDiv.innerHTML = '<p style="color: dodgerblue;">구매 처리 중...</p>'; // 메시지 색상 변경 등 유지 가능
        purchaseButton.disabled = true;

        fetch('/api/label/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataset_id: datasetId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                purchaseStatusDiv.innerHTML = `<p style="color: green;">구매가 성공적으로 완료되었습니다. ${data.message || ''}</p>`;
                // 원래 로직: 구매 성공 후 UI를 직접 변경하거나, 사용자가 새로고침하도록 유도
                purchaseButton.style.display = 'none'; 
                downloadButton.style.display = 'block'; 
                // fetchAndRenderDatasetDetails(); // 이 부분은 이전 상태에는 없었음
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

    // 다운로드 버튼 클릭 이벤트 리스너 (이전과 동일하게 유지)
    downloadButton.addEventListener('click', () => {
        purchaseStatusDiv.innerHTML = '<p style="color: dodgerblue;">다운로드 요청 중...</p>';
        downloadButton.disabled = true;

        fetch(`/api/label/download-package/${datasetId}`)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errData => {
                        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
                    }).catch(() => {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    });
                }
                const disposition = response.headers.get('Content-Disposition');
                let filename = `dataset_${datasetId}_package.zip`; 
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }
                return response.blob().then(blob => ({ blob, filename }));
            })
            .then(({ blob, filename }) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                purchaseStatusDiv.innerHTML = `<p style="color: green;">다운로드가 시작되었습니다: ${filename}</p>`;
                downloadButton.disabled = false;
            })
            .catch(error => {
                console.error('Error during download:', error);
                purchaseStatusDiv.innerHTML = `<p style="color: red;">다운로드 실패: ${error.message}</p>`;
                downloadButton.disabled = false;
            });
    });
});