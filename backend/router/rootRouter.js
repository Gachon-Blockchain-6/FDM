const express = require('express');
const router = express.Router();

const root = require('../lib/root');

router.get("/user-info", (req, res) => {
    if (!req.session.is_logined) {
        return res.json({ point: 0, grade: C, class: 'proxy' });
    }
    root.userinfo(req, res);
});

module.exports = router;

