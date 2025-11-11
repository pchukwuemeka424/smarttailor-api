import mongoose from 'mongoose';

const appSettingsSchema = new mongoose.Schema({
  welcomeScreen: {
    title: {
      type: String,
      default: 'Welcome to',
      trim: true,
    },
    appName: {
      type: String,
      default: 'Smart Tailor',
      trim: true,
    },
    subtitle: {
      type: String,
      default: 'Your complete solution for managing customers, orders, and measurements',
      trim: true,
    },
    backgroundImage: {
      type: String,
      default: 'https://plus.unsplash.com/premium_photo-1676586308549-3982c12e99b5?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1288',
      trim: true,
    },
    logo: {
      type: String,
      default: '',
      trim: true,
    },
  },
  headerColors: {
    primary: {
      type: String,
      default: '#111827',
      trim: true,
    },
    secondary: {
      type: String,
      default: '#667eea',
      trim: true,
    },
    text: {
      type: String,
      default: '#FFFFFF',
      trim: true,
    },
  },
}, {
  timestamps: true,
});

// Ensure only one settings document exists
appSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

appSettingsSchema.statics.updateSettings = async function(updates) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create(updates);
  } else {
    // Update nested fields - need to mark as modified for Mongoose to save
    if (updates.welcomeScreen) {
      if (updates.welcomeScreen.title !== undefined) {
        settings.welcomeScreen.title = updates.welcomeScreen.title;
      }
      if (updates.welcomeScreen.appName !== undefined) {
        settings.welcomeScreen.appName = updates.welcomeScreen.appName;
      }
      if (updates.welcomeScreen.subtitle !== undefined) {
        settings.welcomeScreen.subtitle = updates.welcomeScreen.subtitle;
      }
      if (updates.welcomeScreen.backgroundImage !== undefined) {
        settings.welcomeScreen.backgroundImage = updates.welcomeScreen.backgroundImage;
      }
      if (updates.welcomeScreen.logo !== undefined) {
        settings.welcomeScreen.logo = updates.welcomeScreen.logo;
      }
      settings.markModified('welcomeScreen');
    }
    if (updates.headerColors) {
      if (updates.headerColors.primary !== undefined) {
        settings.headerColors.primary = updates.headerColors.primary;
      }
      if (updates.headerColors.secondary !== undefined) {
        settings.headerColors.secondary = updates.headerColors.secondary;
      }
      if (updates.headerColors.text !== undefined) {
        settings.headerColors.text = updates.headerColors.text;
      }
      settings.markModified('headerColors');
    }
    await settings.save();
  }
  return settings;
};

const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

export default AppSettings;

