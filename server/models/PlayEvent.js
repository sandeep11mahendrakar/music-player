import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      default: null,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    youtubeVideoId: {
      type: String,
      required: true,
      index: true,
    },

    event: {
      type: String,
      enum: [
        'play',
        'pause',
        'resume',
        'skip_next',
        'skip_previous',
        'seek',
        'complete',
        'error',
      ],
      required: true,
    },

    positionSeconds: {
      type: Number,
      default: 0,
    },

    themeId: {
      type: String,
      default: '',
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('PlayEvent', schema);
