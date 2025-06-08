// 이미지 목록 (원하는 이미지로 추가 가능)
const imageList = [
  'assets/sample-dog.jpg',
  'assets/sample-cat.jpg',
  'assets/dog2.png'
];

let currentIndex = 0;
let selectedLabel = null;

// 시작 버튼 클릭 시
function startLabeling() {
  document.querySelector('.start-button').style.display = 'none';
  document.querySelector('.labeling-task').style.display = 'flex';
  document.querySelector('.complete-box').style.display = 'block';
  loadImage();
}

// 라벨 버튼 클릭 시 단일 선택
const buttons = document.querySelectorAll('.label-btn');
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedLabel = btn.dataset.label;
  });
});

// 선택 완료 버튼 클릭 시
function submitLabel() {
  if (!selectedLabel) {
    alert('라벨을 선택해주세요!');
    return;
  }

  // 🔻 서버 전송 자리 (나중에 fetch로 교체 가능)
  console.log(`이미지: ${imageList[currentIndex]}, 선택: ${selectedLabel}`);

  // 라벨링 화면 숨기고 결과 화면 표시
  document.querySelector('.labeling-task').style.display = 'none';
  document.querySelector('.complete-box').style.display = 'none';
  document.querySelector('.result-screen').style.display = 'block';
}

// 다음 버튼 클릭 시
function nextImage() {
  currentIndex++;
  selectedLabel = null;

  if (currentIndex >= imageList.length) {
    alert("모든 라벨링이 완료되었습니다!");
    location.reload(); // 또는 완료 페이지로 이동
    return;
  }

  // 다음 이미지 로드
  loadImage();

  // UI 리셋
  document.querySelectorAll('.label-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('.result-screen').style.display = 'none';
  document.querySelector('.labeling-task').style.display = 'flex';
  document.querySelector('.complete-box').style.display = 'block';
}

// 이미지 출력
function loadImage() {
  const img = document.getElementById('label-image');
  img.src = imageList[currentIndex];
}
