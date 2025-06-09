let imageList = []; // 전역으로 이미지 목록을 관리 (동적으로 채워짐)
let currentIndex = 0;
let selectedLabelData = null; // 선택된 라벨 데이터 (label_id, finalOption)
const MINIO_BASE_URL = 'http://localhost:9000/uploads/'; // MinIO 주소 (환경에 맞게 수정)

document.addEventListener('DOMContentLoaded', async () => {
    // 로그인 상태 확인
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        alert('로그인이 필요합니다.');
        location.href = 'login.html';
        return; // 로그인되지 않았으면 이후 코드 실행 안 함
    }

    const datasetContainer = document.getElementById('dataset-checkboxes');

    // 데이터셋 목록을 불러와 체크박스로 표시
    try {
        const response = await fetch('/api/label/datasetinfo');
        const data = await response.json();

        if (data.success && data.datasets.length > 0) {
            datasetContainer.innerHTML = ''; // "불러오는 중" 메시지 제거
            data.datasets.forEach(dataset => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <input type="checkbox" id="dataset-${dataset.dataset_id}" name="selected_datasets" value="${dataset.dataset_id}">
                    <label for="dataset-${dataset.dataset_id}">${dataset.name} (ID: ${dataset.dataset_id})</label>
                `;
                datasetContainer.appendChild(div);
            });
        } else {
            datasetContainer.innerHTML = '<p>데이터셋을 불러올 수 없거나 생성된 데이터셋이 없습니다.</p>';
            document.querySelector('.start-button').disabled = true; // 시작 버튼 비활성화
        }
    } catch (error) {
        console.error('Error fetching datasets:', error);
        datasetContainer.innerHTML = '<p>데이터셋을 불러오는 중 오류가 발생했습니다.</p>';
        document.querySelector('.start-button').disabled = true; // 시작 버튼 비활성화
    }
});

// 시작 버튼 클릭 시
async function startLabeling() {
    const selectedCheckboxes = document.querySelectorAll('input[name="selected_datasets"]:checked');

    if (selectedCheckboxes.length === 0) {
        alert('라벨링을 진행할 데이터셋을 하나 이상 선택해주세요.');
        return;
    }

    const selectedDatasetId = selectedCheckboxes[0].value;
    if (selectedCheckboxes.length > 1) {
        alert(`여러 데이터셋이 선택되었습니다. 첫 번째 선택된 데이터셋 (ID: ${selectedDatasetId})의 라벨링을 시작합니다.`);
    }

    try {
        // 1. 이미지 정보 가져오기
        const imageResponse = await fetch(`/api/label/labelinfo/${selectedDatasetId}`);
        const imageData = await imageResponse.json();

        if (!imageData.success || imageData.labels.length === 0) {
            alert('선택된 데이터셋에 라벨링할 이미지가 없거나, 이미지 정보를 불러올 수 없습니다.');
            imageList = [];
            return;
        }
        imageList = imageData.labels.map(label => ({ 
            label_id: label.label_id, 
            source: `${MINIO_BASE_URL}${label.source}` 
        }));

        // 2. 옵션 정보 가져오기
        const optionResponse = await fetch(`/api/label/options/${selectedDatasetId}`);
        const optionData = await optionResponse.json();

        if (!optionData.success || optionData.options.length === 0) {
            alert('선택된 데이터셋의 라벨링 옵션을 불러올 수 없습니다.');
            return;
        }

        // 3. 라벨링 버튼 동적 생성
        const buttonBox = document.querySelector('.button-box');
        buttonBox.innerHTML = ''; // 기존 버튼 제거
        optionData.options.forEach(opt => {
            const button = document.createElement('button');
            button.classList.add('label-btn');
            button.dataset.label = opt.content; // finalOption으로 저장될 값
            button.textContent = opt.content;
            button.addEventListener('click', () => {
                // 모든 버튼에서 selected 클래스 제거
                buttonBox.querySelectorAll('.label-btn').forEach(b => b.classList.remove('selected'));
                // 현재 버튼에 selected 클래스 추가
                button.classList.add('selected');
                selectedLabelData = {
                    label_id: imageList[currentIndex].label_id,
                    finalOption: button.dataset.label
                };
            });
            buttonBox.appendChild(button);
        });

        currentIndex = 0;
        selectedLabelData = null;

        document.getElementById('dataset-selection-container').style.display = 'none';
        document.querySelector('.start-button').style.display = 'none';
        document.querySelector('.labeling-task').style.display = 'flex';
        document.querySelector('.complete-box').style.display = 'block';
        loadImage();

    } catch (error) {
        console.error('Error during labeling setup:', error);
        alert('라벨링을 준비하는 중 오류가 발생했습니다.');
        imageList = [];
    }
}

// 선택 완료 버튼 클릭 시
async function submitLabel() {
  if (!selectedLabelData || !selectedLabelData.finalOption) {
    alert('라벨을 선택해주세요!');
    return;
  }

  try {
    const response = await fetch('/api/label/submit_label', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            label_id: selectedLabelData.label_id,
            finalOption: selectedLabelData.finalOption
        }),
    });

    const result = await response.json();

    if (result.success) {
        // console.log('라벨링(투표) 기록 성공:', result);
        // 라벨링 화면 숨기고 결과 화면 표시 (이 부분은 이미 nextImage() 호출 시 처리됨)
        // document.querySelector('.labeling-task').style.display = 'none';
        // document.querySelector('.complete-box').style.display = 'none';
        // document.querySelector('.result-screen').style.display = 'block';
        // 여기서는 단순히 다음 이미지로 넘어가는 것을 유도할 수 있습니다.
        // 또는 성공 메시지를 짧게 보여주고 nextImage()를 호출할 수도 있습니다.
    } else {
        alert(result.message || '라벨링(투표) 저장에 실패했습니다.');
        return; // 실패 시 다음 이미지로 넘어가지 않음
    }

  } catch (error) {
    console.error('Error submitting label:', error);
    alert('라벨링(투표) 저장 중 오류가 발생했습니다.');
    return; // 실패 시 다음 이미지로 넘어가지 않음
  }
  
  // 성공적으로 서버에 전송 후, 결과 화면을 보여주고 다음 이미지로 넘어갈 준비
  document.querySelector('.labeling-task').style.display = 'none';
  document.querySelector('.complete-box').style.display = 'none';
  document.querySelector('.result-screen').style.display = 'block';
}

// 다음 버튼 클릭 시
function nextImage() {
  currentIndex++;
  selectedLabelData = null;

  if (currentIndex >= imageList.length) {
    alert("모든 라벨링이 완료되었습니다!");
    document.getElementById('dataset-selection-container').style.display = 'block';
    document.querySelector('.start-button').style.display = 'block';
    document.querySelector('.result-screen').style.display = 'none';
    document.querySelectorAll('input[name="selected_datasets"]:checked').forEach(cb => cb.checked = false);
    imageList = [];
    document.querySelector('.button-box').innerHTML = ''; // 버튼 제거
    return;
  }

  loadImage();

  document.querySelectorAll('.label-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('.result-screen').style.display = 'none';
  document.querySelector('.labeling-task').style.display = 'flex';
  document.querySelector('.complete-box').style.display = 'block';
}

// 이미지 출력
function loadImage() {
  if (imageList.length > 0 && currentIndex < imageList.length) {
    const img = document.getElementById('label-image');
    img.src = imageList[currentIndex].source;
  } else {
    console.log("No more images to load or imageList is empty.");
    document.querySelector('.labeling-task').style.display = 'none';
    document.querySelector('.complete-box').style.display = 'none';
    if (!alert("라벨링할 이미지가 더 이상 없습니다. 다른 데이터셋을 선택하거나 업로드해주세요.")){
        document.getElementById('dataset-selection-container').style.display = 'block';
        document.querySelector('.start-button').style.display = 'block';
    }
  }
}
