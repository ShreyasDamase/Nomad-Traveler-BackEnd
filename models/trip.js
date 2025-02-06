const mongoose = require('mongoose');
const expenseSchema = new mongoose.Schema({
  category: {type: String, required: true},
  price: {type: Number, required: true},
  splitBy: {type: String, required: true},
  paidBy: {type: String, required: true},
});
const placeSchema = new mongoose.Schema({
  name: {type: String, required: true},
  phoneNumber: {type: String},
  website: {type: String},
  openingHours: [{type: String}], // Array of opening hours
  photos: [{type: String}], // Array of photo URLs
  reviews: [
    {
      authorName: String,
      rating: Number,
      text: String,
    },
  ],
  types: [String],
  formatted_Address: {type: String, required: false},
  briefDescription: {type: String},
  geometry: {
    location: {
      lat: {type: Number, required: true},
      lng: {type: Number, required: true},
    },
    viewport: {
      northeast: {
        lat: {type: Number, required: true},
        lng: {type: Number, required: true},
      },
      southwest: {
        lat: {type: Number, required: true},
        lng: {type: Number, required: true},
      },
    },
  },
});

const activitySchema = new mongoose.Schema({
  date: {type: String, required: true},
  name: {type: String, required: true},
  phoneNumber: {type: String, default: null},
  website: {type: String, default: null},
  openingHours: [{type: String}], // Default to an empty array
  photos: {type: String, default: null},
  reviews: {type: Array, default: []},
  types: {type: Array, default: []},
  formatted_address: {type: String, default: ''},
  briefDescription: {type: String, default: ''},
  geometry: {
    type: {
      location: {
        lat: Number,
        lng: Number,
      },
      viewport: {
        northeast: {
          lat: Number,
          lng: Number,
        },
        southwest: {
          lat: Number,
          lng: Number,
        },
      },
    },
    default: null,
  },
});
const itinerarySchema = new mongoose.Schema({
  date: {type: String, required: true}, // Only required field
  activities: [activitySchema], // Will be empty initially
  // Make all other fields optional
  phoneNumber: {type: String, default: null},
  website: {type: String, default: null},
  openingHours: [{type: String}],
  photos: {type: String, default: null},
  reviews: {type: Array, default: []},
  types: {type: Array, default: []},
  formatted_address: {type: String, default: ''},
  briefDescription: {type: String, default: ''},
  geometry: {
    type: {
      location: {
        lat: Number,
        lng: Number,
      },
      viewport: {
        northeast: {
          lat: Number,
          lng: Number,
        },
        southwest: {
          lat: Number,
          lng: Number,
        },
      },
    },
    default: null,
  },
});

const tripSchema = mongoose.Schema({
  tripName: {type: String, required: true},
  startDate: {type: String, required: true},
  endDate: {type: String, required: true},
  startDay: {type: String, required: true},
  endDay: {type: String, required: true},
  background: {type: String, required: true},
  host: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  travelers: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
  budget: {type: Number, default: 0},
  expenses: [expenseSchema],
  placesToVisit: [placeSchema],
  itinerary: [itinerarySchema],
  Notes: {type: String, default: ''},
});
const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
