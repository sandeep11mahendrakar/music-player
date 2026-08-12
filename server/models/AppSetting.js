import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    description: {
      type: String,
      default: '',
    },

    editable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('AppSetting', schema);
