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
    const { role, approved } = req.query;
    const query = {};

    if (role) query.role = role;
    if (approved !== undefined) query.isApproved = approved === 'true';

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

// Approve user
router.patch('/users/:id/approve', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isApproved = true;
    await user.save();

    res.json({
      message: 'User approved successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ message: 'Server error while approving user' });
  }
});

// Reject/Revoke user approval
router.patch('/users/:id/revoke', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isApproved = false;
    await user.save();

    res.json({
      message: 'User approval revoked successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error('Revoke user error:', error);
    res.status(500).json({ message: 'Server error while revoking user approval' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
});

// Create exam session with assigned examiner and students
router.post('/sessions', async (req, res) => {
  try {
    const { examId, examinerId, assignedStudents } = req.body;

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
    if (examiner.role !== 'examiner' && examiner.role !== 'admin') {
      return res.status(400).json({ message: 'Selected user is not an examiner' });
    }

    // Verify assigned students if provided
    if (assignedStudents && assignedStudents.length > 0) {
      const students = await User.find({
        _id: { $in: assignedStudents },
        role: 'student'
      });

      if (students.length !== assignedStudents.length) {
        return res.status(400).json({ message: 'One or more assigned students are invalid' });
      }
    }

    // Create session
    const session = new ExamSession({
      exam: examId,
      examiner: examinerId,
      assignedStudents: assignedStudents || [],
      status: 'scheduled',
      timeRemaining: exam.duration * 60 // Convert minutes to seconds
    });

    await session.save();
    await session.populate('exam');
    await session.populate('examiner', 'firstName lastName email');
    await session.populate('assignedStudents', 'firstName lastName email');

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
    if (examiner.role !== 'examiner' && examiner.role !== 'admin') {
      return res.status(400).json({ message: 'Selected user is not an examiner' });
    }

    // Update examiner (admin can reassign anytime)
    session.examiner = examinerId;
    session.lastUpdated = Date.now();
    await session.save();
    await session.populate('exam');
    await session.populate('examiner', 'firstName lastName email');
    await session.populate('assignedStudents', 'firstName lastName email');

    res.json({
      message: 'Examiner assigned successfully',
      session
    });
  } catch (error) {
    console.error('Assign examiner error:', error);
    res.status(500).json({ message: 'Server error while assigning examiner' });
  }
});

// Update session to assign students
router.patch('/sessions/:id/assign-students', async (req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({ message: 'Student IDs array is required' });
    }

    // Verify session exists
    const session = await ExamSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Verify all students exist and have correct role
    if (studentIds.length > 0) {
      const students = await User.find({
        _id: { $in: studentIds },
        role: 'student'
      });

      if (students.length !== studentIds.length) {
        return res.status(400).json({ message: 'One or more student IDs are invalid' });
      }
    }

    // Update assigned students
    session.assignedStudents = studentIds;
    session.lastUpdated = Date.now();
    await session.save();
    await session.populate('exam');
    await session.populate('examiner', 'firstName lastName email');
    await session.populate('assignedStudents', 'firstName lastName email');

    res.json({
      message: 'Students assigned successfully',
      session
    });
  } catch (error) {
    console.error('Assign students error:', error);
    res.status(500).json({ message: 'Server error while assigning students' });
  }
});

// Update session details (admin can edit any session)
router.patch('/sessions/:id', async (req, res) => {
  try {
    const { status, timeRemaining } = req.body;

    const session = await ExamSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Update allowed fields
    if (status) session.status = status;
    if (timeRemaining !== undefined) session.timeRemaining = timeRemaining;
    session.lastUpdated = Date.now();

    await session.save();
    await session.populate('exam');
    await session.populate('examiner', 'firstName lastName email');
    await session.populate('assignedStudents', 'firstName lastName email');

    res.json({
      message: 'Session updated successfully',
      session
    });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ message: 'Server error while updating session' });
  }
});

// Get all sessions (admin view)
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ExamSession.find()
      .populate('exam')
      .populate('examiner', 'firstName lastName email')
      .populate('assignedStudents', 'firstName lastName email')
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
