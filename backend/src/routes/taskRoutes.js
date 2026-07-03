const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');
const { uploadProof } = require('../middleware/upload');

router.get('/', requireAuth, taskController.listTasks);
router.get('/my-submissions', requireAuth, taskController.myTaskSubmissions);
router.get('/:id', requireAuth, taskController.getTask);
router.post('/:id/submit', requireAuth, uploadProof.single('proofFile'), taskController.submitTask);

// CPA network postback — NOT behind requireAuth (it's a server-to-server
// call from the CPA network itself, authenticated via the secret query param)
router.get('/cpa/postback', taskController.cpaPostback);

module.exports = router;
