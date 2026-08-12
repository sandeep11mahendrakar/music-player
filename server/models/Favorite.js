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
  },
  {
    timestamps: true,
  }
);

schema.index(
  { visitorId: 1, youtubeVideoId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      visitorId: {
        $type: 'string',
      },
    },
  }
);

schema.index(
  { userId: 1, youtubeVideoId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      userId: {
        $type: 'objectId',
      },
    },
  }
);

export default mongoose.model('Favorite', schema);
