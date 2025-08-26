// controllers/chatController.js
const ChatMessage = require('../models/chatBot');
const Joi = require('joi');
const mongoose = require('mongoose');
const fetch = require('node-fetch'); // Cần install node-fetch nếu chưa có
const { v4: uuidv4 } = require('uuid'); // Cần install uuid nếu chưa có

// API setup (lấy từ env để bảo mật)
const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// Validation schemas
const messageValidationSchema = Joi.object({
  sessionId: Joi.string().optional(), // Nếu không có, tạo mới
  message: Joi.string().required(),
  file: Joi.object({
    data: Joi.string().optional(),
    mime_type: Joi.string().optional(),
  }).optional(),
});

// Tạo session chat mới hoặc lấy session hiện tại
exports.createOrGetSession = async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId) {
      sessionId = uuidv4();
    }

    // Kiểm tra session tồn tại bằng cách lấy tin nhắn đầu tiên
    const existingMessage = await ChatMessage.findOne({ sessionId });
    if (!existingMessage) {
      // Tạo tin nhắn chào mừng từ bot
      const welcomeMessage = new ChatMessage({
        sessionId,
        role: 'model',
        content: 'Xin chào 👋\nTôi có thể giúp gì cho bạn hôm nay?',
      });
      await welcomeMessage.save();
    }

    res.status(200).json({ sessionId });
  } catch (error) {
    console.error('Lỗi trong createOrGetSession:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo hoặc lấy session chat' });
  }
};

// Gửi tin nhắn và nhận phản hồi từ bot
exports.sendMessage = async (req, res) => {
  try {
    const { error, value } = messageValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details.map((e) => e.message).join(', ') });
    }

    const { sessionId, message, file } = value;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID là bắt buộc' });
    }

    // Lưu tin nhắn người dùng
    const userMessage = new ChatMessage({
      sessionId,
      role: 'user',
      content: message,
      file: file || null,
    });
    await userMessage.save();

    // Lấy lịch sử chat cho session
    const chatHistory = await ChatMessage.find({ sessionId })
      .sort({ timestamp: 1 })
      .lean()
      .then(messages => messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }, ...(msg.file?.data ? [{ inline_data: msg.file }] : [])],
      })));

    // Gửi yêu cầu đến Gemini API
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: chatHistory }),
    };

    const response = await fetch(API_URL, requestOptions);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    const botResponseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '$1').trim();

    // Lưu tin nhắn bot
    const botMessage = new ChatMessage({
      sessionId,
      role: 'model',
      content: botResponseText,
    });
    await botMessage.save();

    res.status(200).json({ message: botResponseText });
  } catch (error) {
    console.error('Lỗi trong sendMessage:', error);
    res.status(500).json({ error: 'Lỗi server khi gửi tin nhắn', details: error.message });
  }
};

// Lấy lịch sử chat theo session
exports.getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID là bắt buộc' });
    }

    const messages = await ChatMessage.find({ sessionId })
      .select('role content file timestamp')
      .sort({ timestamp: 1 })
      .lean();

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Lỗi trong getChatHistory:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử chat' });
  }
};

// Xóa session chat
exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID là bắt buộc' });
    }

    await ChatMessage.deleteMany({ sessionId });
    res.status(200).json({ message: 'Xóa session chat thành công' });
  } catch (error) {
    console.error('Lỗi trong deleteSession:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa session chat' });
  }
};