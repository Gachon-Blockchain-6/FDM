const express = require('express');
const router = express.Router();
const auth = require('../lib/auth');

// 로그인 처리
router.post('/login_process', (req, res) => {
    auth.login_process(req, res);
});

// 로그아웃 처리
router.get('/logout_process', (req, res) => {
    auth.logout_process(req, res);
});

// 회원가입 처리
router.post('/register_process', (req, res) => {
    auth.register_process(req, res);
});

// 익명 로그인
router.post('/proxy_login', (req, res) => {
    auth.proxy_login(req, res);
});

module.exports = router;
