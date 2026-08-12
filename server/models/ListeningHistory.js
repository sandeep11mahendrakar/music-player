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

    title: {
      type: String,
      default: '',
    },

    themeId: {
      type: String,
      default: '',
      index: true,
    },

    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist',
      default: null,
    },

    playedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    listenedSeconds: {
      type: Number,
      default: 0,
    },

    completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ListeningHistory', schema);
