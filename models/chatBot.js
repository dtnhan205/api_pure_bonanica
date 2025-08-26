const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'model'],
          required: true,
        },
        content: {
          type: String,
          required: true,
          maxlength: 5000,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
      { maxlength: 200 },
    ],
  },
  { versionKey: false, timestamps: true }
);

chatMessageSchema.index({ sessionId: 1 });
chatMessageSchema.index({ 'messages.timestamp': 1 });
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);