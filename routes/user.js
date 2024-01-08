const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json([
        {
            username: 'Daniel',
            age: 26
        },
        {
            username: 'Esteban',
            age: 32
        }
    ])
})

module.exports = router;
