const express = require('express');
const router = express.Router();
const ExamSession = require('../models/ExamSession');
const Exam = require('../models/Exam');
const { authenticate, authorize } = require('../middleware/auth');

// Create new exam session (Examiner only)
router.post('/', authenticate, authorize('examiner', 'admin'), async (req, res) => {
  try {
    const { examId } = req.body;

    if (!examId) {
      return res.status(400).json({ message: 'Exam ID is required' });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const session = new ExamSession({
      exam: examId,
      examiner: req.userId,
      status: 'scheduled',
      timeRemaining: exam.duration * 60 // Convert minutes to seconds
    });

    await session.save();
    await session.populate('exam');

    res.status(201).json({
      message: 'Exam session created successfully',
      session
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Server error while creating session' });
  }
});

// Get all sessions
router.get('/', authenticate, async (req, res) => {
  try {
    let query = {};

    // If user is examiner, show only their sessions
    if (req.user.role === 'examiner') {
      query.examiner = req.userId;
    }

    const sessions = await ExamSession.find(query)
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

// Get single session
router.get('/:id', authenticate, async (req, res) => {
  try {
    const session = await ExamSession.findById(req.params.id)
      .populate({
        path: 'exam',
        populate: { path: 'cases' }
      })
      .populate('examiner', 'firstName lastName email')
      .populate('participants.student', 'firstName lastName email');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Server error while fetching session' });
  }
});

// Join session (Student only)
router.post('/:id/join', authenticate, authorize('student'), async (req, res) => {
  try {
    const session = await ExamSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ message: 'This session has ended' });
    }

    // Check if already joined
    const alreadyJoined = session.participants.some(
      p => p.student.toString() === req.userId
    );

    if (!alreadyJoined) {
      session.participants.push({
        student: req.userId,
        joinedAt: new Date(),
        isActive: true
      });
      await session.save();
    }

    await session.populate({
      path: 'exam',
      populate: { path: 'cases' }
    });

    res.json({
      message: 'Joined session successfully',
      session
    });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ message: 'Server error while joining session' });
  }
});

// Delete session
router.delete('/:id', authenticate, authorize('examiner', 'admin'), async (req, res) => {
  try {
    const session = await ExamSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Examiners can only delete their own sessions
    if (req.user.role === 'examiner' && session.examiner.toString() !== req.userId) {
      return res.status(403).json({ message: 'You can only delete your own sessions' });
    }

    await ExamSession.findByIdAndDelete(req.params.id);

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Server error while deleting session' });
  }
});

module.exports = router;
