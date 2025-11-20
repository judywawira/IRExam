const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const { authenticate, authorize } = require('../middleware/auth');

// Create new exam
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, description, cases, duration } = req.body;

    if (!title || !cases || !duration) {
      return res.status(400).json({
        message: 'Title, cases, and duration are required'
      });
    }

    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({
        message: 'At least one case must be selected'
      });
    }

    const newExam = new Exam({
      title,
      description,
      cases,
      duration,
      createdBy: req.userId
    });

    await newExam.save();
    await newExam.populate('cases');

    res.status(201).json({
      message: 'Exam created successfully',
      exam: newExam
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ message: 'Server error while creating exam' });
  }
});

// Get all exams
router.get('/', authenticate, async (req, res) => {
  try {
    const exams = await Exam.find()
      .populate('cases')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ exams });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ message: 'Server error while fetching exams' });
  }
});

// Get single exam
router.get('/:id', authenticate, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('cases')
      .populate('createdBy', 'firstName lastName email');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    res.json({ exam });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ message: 'Server error while fetching exam' });
  }
});

// Update exam
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, description, cases, duration } = req.body;
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (title) exam.title = title;
    if (description !== undefined) exam.description = description;
    if (cases) exam.cases = cases;
    if (duration) exam.duration = duration;

    await exam.save();
    await exam.populate('cases');

    res.json({
      message: 'Exam updated successfully',
      exam
    });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ message: 'Server error while updating exam' });
  }
});

// Clone exam
router.post('/:id/clone', authenticate, authorize('admin'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('cases');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Create a new exam with the same data but new title
    const clonedExam = new Exam({
      title: `${exam.title} (Copy)`,
      description: exam.description,
      cases: exam.cases.map(c => c._id), // Copy case IDs
      duration: exam.duration,
      createdBy: req.userId
    });

    await clonedExam.save();
    await clonedExam.populate('cases');

    res.status(201).json({
      message: 'Exam cloned successfully',
      exam: clonedExam
    });
  } catch (error) {
    console.error('Clone exam error:', error);
    res.status(500).json({ message: 'Server error while cloning exam' });
  }
});

// Delete exam
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    await Exam.findByIdAndDelete(req.params.id);

    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ message: 'Server error while deleting exam' });
  }
});

module.exports = router;
