const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ExamSession = require('../models/ExamSession');
const Exam = require('../models/Exam');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Get all examiners
router.get('/examiners', async (req, res) => {
  try {
    const examiners = await User.find({ role: 'examiner' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      examiners,
      count: examiners.length
    });
  } catch (error) {
    console.error('Get examiners error:', error);
    res.status(500).json({ message: 'Server error while fetching examiners' });
  }
});

// Get all users (for admin user management)
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

// Create exam session with assigned examiner
router.post('/sessions', async (req, res) => {
  try {
    const { examId, examinerId } = req.body;

    if (!examId) {
      return res.status(400).json({ message: 'Exam ID is required' });
    }

    if (!examinerId) {
      return res.status(400).json({ message: 'Examiner ID is required' });
    }

    // Verify exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Verify examiner exists and has correct role
    const examiner = await User.findById(examinerId);
    if (!examiner) {
      return res.status(404).json({ message: 'Examiner not found' });
    }
    if (examiner.role !== 'examiner') {
      return res.status(400).json({ message: 'Selected user is not an examiner' });
    }

    // Create session
    const session = new ExamSession({
      exam: examId,
      examiner: examinerId,
      status: 'scheduled',
      timeRemaining: exam.duration * 60 // Convert minutes to seconds
    });

    await session.save();
    await session.populate('exam');
    await session.populate('examiner', 'firstName lastName email');

    res.status(201).json({
      message: 'Exam session created successfully',
      session
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Server error while creating session' });
  }
});

// Update session to assign/reassign examiner
router.patch('/sessions/:id/assign-examiner', async (req, res) => {
  try {
    const { examinerId } = req.body;

    if (!examinerId) {
      return res.status(400).json({ message: 'Examiner ID is required' });
    }

    // Verify session exists
    const session = await ExamSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Verify examiner exists and has correct role
    const examiner = await User.findById(examinerId);
    if (!examiner) {
      return res.status(404).json({ message: 'Examiner not found' });
    }
    if (examiner.role !== 'examiner') {
      return res.status(400).json({ message: 'Selected user is not an examiner' });
    }

    // Prevent reassignment if session is active or completed
    if (session.status === 'active') {
      return res.status(400).json({
        message: 'Cannot reassign examiner for an active session'
      });
    }
    if (session.status === 'completed') {
      return res.status(400).json({
        message: 'Cannot reassign examiner for a completed session'
      });
    }

    // Update examiner
    session.examiner = examinerId;
    await session.save();
    await session.populate('exam');
    await session.populate('examiner', 'firstName lastName email');

    res.json({
      message: 'Examiner assigned successfully',
      session
    });
  } catch (error) {
    console.error('Assign examiner error:', error);
    res.status(500).json({ message: 'Server error while assigning examiner' });
  }
});

// Get all sessions (admin view)
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ExamSession.find()
      .populate('exam')
      .populate('examiner', 'firstName lastName email')
      .populate('participants.student', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Server error while fetching sessions' });
  }
});

// Delete any session (admin privilege)
router.delete('/sessions/:id', async (req, res) => {
  try {
    const session = await ExamSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    await ExamSession.findByIdAndDelete(req.params.id);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Server error while deleting session' });
  }
});

module.exports = router;
