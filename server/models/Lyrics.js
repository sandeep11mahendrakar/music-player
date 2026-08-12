import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      default: '',
    },

    startTime: {
      type: Number,
      default: 0,
    },

    endTime: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const schema = new mongoose.Schema(
  {
    youtubeVideoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    language: {
      type: String,
      default: 'en',
    },

    source: {
      type: String,
      default: 'youtube',
    },

    synced: {
      type: Boolean,
      default: false,
    },

    plainText: {
      type: String,
      default: '',
    },

    lines: {
      type: [lineSchema],
      default: [],
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Lyrics', schema);
