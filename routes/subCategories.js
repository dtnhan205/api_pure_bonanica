const express = require('express');
const router = express.Router();
const SubCategory = require('../models/subCategory');

// Create subcategory
router.post('/', async (req, res) => {
  try {
    const subCategory = new SubCategory(req.body);
    await subCategory.save();
    res.status(201).json(subCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all subcategories
router.get('/', async (req, res) => {
  try {
    const subCategories = await SubCategory.find().populate('category');
    res.json(subCategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single subcategory
router.get('/:id', async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id).populate('category');
    if (!subCategory) return res.status(404).json({ message: 'SubCategory not found' });
    res.json(subCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update subcategory
router.put('/:id', async (req, res) => {
  try {
    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!subCategory) return res.status(404).json({ message: 'SubCategory not found' });
    res.json(subCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete subcategory
router.delete('/:id', async (req, res) => {
  try {
    const subCategory = await SubCategory.findByIdAndDelete(req.params.id);
    if (!subCategory) return res.status(404).json({ message: 'SubCategory not found' });
    res.json({ message: 'SubCategory deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});