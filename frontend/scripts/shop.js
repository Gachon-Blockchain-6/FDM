document.addEventListener('DOMContentLoaded', () => {
    const productListContainer = document.querySelector('.product-list');

    if (!productListContainer) {
        console.error('Product list container not found!');
        return;
    }

    fetch('/api/label/datasetinfo') // 백엔드 API 엔드포인트
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.datasets) {
                productListContainer.innerHTML = ''; // 기존 아이템 삭제
                if (data.datasets.length > 0) {
                    data.datasets.forEach(dataset => {
                        const productCard = document.createElement('div');
                        productCard.classList.add('product-card');
                        productCard.textContent = dataset.name; // 데이터셋 이름 표시
                        const priceDisplay = document.createElement('p');
                        priceDisplay.textContent = dataset.price !== undefined ? `${dataset.price.toLocaleString()} KRW` : '가격 정보 없음';
                        productCard.appendChild(priceDisplay);
                        productCard.onclick = () => {
                            // shopDetail.html로 ID와 함께 이동
                            window.location.href = `shopDetail.html?id=${dataset.dataset_id}`; 
                        };
                        productListContainer.appendChild(productCard);
                    });
                } else {
                    // 성공적으로 응답받았으나 데이터가 없는 경우
                    productListContainer.innerHTML = '<p>현재 판매 중인 데이터셋이 없습니다.</p>';
                }
            } else {
                // API 요청 자체가 실패했거나, success: false를 반환한 경우
                console.error('Failed to load datasets:', data.message);
                productListContainer.innerHTML = '<p>데이터를 불러오는 데 실패했습니다.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching datasets:', error);
            productListContainer.innerHTML = `<p>데이터 로딩 중 오류 발생: ${error.message}</p>`;
        });
});