document.getElementById('add-option-btn').addEventListener('click', () => {
    const optionsContainer = document.getElementById('options-container');
    const optionDiv = document.createElement('div');
    optionDiv.classList.add('option-field');
    optionDiv.innerHTML = `
    <input type="text" class="option-input" required>
    <button type="button" class="remove-option-btn">삭제</button>
  `;
    optionsContainer.appendChild(optionDiv);
});

document.getElementById('options-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-option-btn')) {
        e.target.parentElement.remove();
    }
});

document.getElementById('datasetForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const price = document.getElementById('price').value;
    const content = document.getElementById('content').value;
    const question = document.getElementById('question').value;
     
    const options = Array.from(document.querySelectorAll('.option-input'))
                         .map(input => input.value.trim())
                         .filter(value => value !== '');

    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';

    if (options.length === 0) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = '최소 1개 이상의 옵션을 추가해야 합니다.';
        return;
    }

    try {
        const res = await fetch('/api/label/create_dataset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price, content, question, options })
        });

        const data = await res.json();

        if (data.success) {
            messageDiv.style.color = 'green';
            messageDiv.textContent = '데이터셋이 성공적으로 생성되었습니다!';
            document.getElementById('datasetForm').reset();
            document.getElementById('options-container').innerHTML = ''; // 옵션 필드 초기화
        } else {
            messageDiv.style.color = 'red';
            messageDiv.textContent = data.message || '생성에 실패했습니다.';
        }
    } catch (err) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = '서버 오류가 발생했습니다.';
    }
});
