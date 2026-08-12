import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    visitorId: {
      type: String,
      default: null,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    themeId: {
      type: String,
      default: 'set1',
    },

    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist',
      default: null,
    },

    currentVideoId: {
      type: String,
      default: '',
    },

    listenerCount: {
      type: Number,
      default: 0,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ListeningSession', schema);
