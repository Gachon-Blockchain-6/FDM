const express = require('express');
const router = express.Router();
const board = require('../lib/board');


// 게시글 목록 조회
router.get('/view', (req, res) => {
    board.view(req, res);
});


// 게시글 생성 화면
router.get('/create', (req, res) => {
    board.create(req, res);
});

// 게시글 생성
router.post('/create_process', (req, res) => {
    board.create_process(req, res);
});

// 게시글 상세 조회
router.get('/detail/:boardId', (req, res) => {
    board.detail(req, res);
});

// 게시글 수정 화면
router.get('/update/:boardId', (req, res) => {
    board.update(req, res);
});

// 게시글 수정
router.post('/update_process', (req, res) => {
    board.update_process(req, res);
});

// 게시글 삭제
router.post('/delete/:boardId', (req, res) => {
    board.delete_process(req, res);
});

module.exports = router;
