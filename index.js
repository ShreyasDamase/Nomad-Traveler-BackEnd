const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const API_KEY = process.env.API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
console.log('Loaded API Key:', API_KEY); // You can print it, but keep it secure!
console.log('Mongo URI:', MONGO_URI); // For debugging (avoid logging sensitive data)
// Initialize express app
const app = express();
const port = 8000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// MongoDB connection
mongoose
  .connect('mongodb+srv://shreyasdamase:bokya@cluster0.ss0lg.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(error => {
    console.error('❌ Error in connecting to MongoDB:', error);
    process.exit(1); // Exit the process if MongoDB connection fails
  });

// Start server
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});

// Import Trip model
const Trip = require('./models/trip');
const User = require('./models/user');
 const {relativeTimeRounding} = require('moment');

// Route: Create a new trip
app.post('/trip', async (req, res) => {
  try {
    const {tripName, startDate, endDate, startDay, endDay, background, host} =
      req.body;

    // Validate required fields
    if (!tripName || !startDate || !endDate) {
      return res.status(400).json({error: 'Trip name and dates are required'});
    }

    // Parse and validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({error: 'Invalid dates'});
    }

    if (end < start) {
      return res
        .status(400)
        .json({error: 'End date cannot be before start date'});
    }

    // Initialize itinerary
    const itinerary = [];
    let currentDate = new Date(start);

    while (currentDate <= end) {
      itinerary.push({
        date: currentDate.toISOString(), // Keep ISO format
        activities: [],
      });
      currentDate.setDate(currentDate.getDate() + 1); // Increment by one day
    }

    // Create and save trip
    const newTrip = new Trip({
      tripName,
      startDate,
      endDate,
      startDay,
      endDay,
      background,
      itinerary,
      host,
      travelers: [host],
    });

    await newTrip.save();
    res.status(201).json({message: 'Trip created successfully', trip: newTrip});
  } catch (error) {
    console.error('❌ Error creating trip:', error);
    res.status(500).json({error: 'Failed to create trip'});
  }
});

// Route: Get all trips
app.get('/trips/:userId', async (req, res) => {
  const {userId} = req.params;
  console.log(userId);
  try {
    const trips = await Trip.find({
      $or: [{host: userId}, {travelers: userId}],
    }).populate('travelers', 'name email photo');
    res.status(200).json(trips);
  } catch (error) {
    console.error('❌ Error fetching trips:', error);
    res.status(500).json({error: 'Failed to fetch trips'});
  }
});

// Route: Add a place to a trip
app.post('/trip/:tripId/addPlace', async (req, res) => {
  try {
    const {tripId} = req.params;
    const {placeId} = req.body;
    // Validate required data
    if (!placeId) {
      return res.status(400).json({error: 'Place ID is required'});
    }
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${API_KEY}`;

    const response = await axios.get(url);
    const details = response.data.result;
    console.log('data', details);
    const placeData = {
      name: details.name,
      phoneNumber: details.formatted_phone_number,
      website: details.website,
      openingHours: details.opening_hours?.weekday_text,
      photos: details.photos?.map(
        photo =>
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${API_KEY}`,
      ),
      reviews: details?.reviews?.map(review => ({
        authorName: review.author_name,
        rating: review.rating,
        text: review.text,
      })),
      types: details?.types,
      formatted_address: details.formatted_address,
      briefDescription:
        details?.editorial_summary?.overview ||
        (details?.reviews && details.reviews[0]?.text) ||
        'No description available',
      geometry: {
        location: {
          lat: details.geometry?.location?.lat,
          lng: details.geometry?.location?.lng,
        },
        viewport: {
          northeast: {
            lat: details.geometry.viewport.northeast.lat,
            lng: details.geometry.viewport.northeast.lng,
          },
          southwest: {
            lat: details.geometry.viewport.southwest.lat,
            lng: details.geometry.viewport.southwest.lng,
          },
        },
      },
    };

    const updatedTrip = await Trip.findByIdAndUpdate(
      tripId,
      {$push: {placesToVisit: placeData}},
      {new: true},
    );
    res.status(200).json(updatedTrip);
  } catch (error) {
    console.error(
      '❌ Error adding place to trip:',
      error.response?.data || error.message,
    );
    res.status(500).json({
      error: 'Failed to add place to trip',
      details: error.response?.data || error.message,
    });
  }
});

app.get('/trip/:tripId/placesToVisit', async (req, res) => {
  try {
    const {tripId} = req.params;
    const trip = await Trip.findById(tripId).select('placesToVisit');
    if (!trip) {
      return res.status(404).json.apply({error: 'trip is not found'});
    }
    res.status(200).json(trip.placesToVisit);
  } catch (error) {
    console.log('Error in getting visited place', error);
    res.status(500).json({
      error: 'faild to fetch places',
      details: error.response?.data || error.message,
    });
  }
});

app.post('/trips/:tripId/itinerary/:date', async (req, res) => {
  try {
    const {tripId, date} = req.params; // Extract tripId and date from params
    const newActivity = req.body; // Extract the activity from request body

    // Update the itinerary entry by pushing the new activity and updating other fields
    const updatedTrip = await Trip.findOneAndUpdate(
      {
        _id: tripId,
        'itinerary.date': date, // Match the correct itinerary entry by date
      },
      {
        $set: {
          'itinerary.$.phoneNumber': newActivity.phoneNumber,
          'itinerary.$.website': newActivity.website,
          'itinerary.$.openingHours': newActivity.openingHours,
          'itinerary.$.photos': newActivity.photos,
          'itinerary.$.reviews': newActivity.reviews,
          'itinerary.$.formatted_address': newActivity.formatted_address,
          'itinerary.$.briefDescription': newActivity.briefDescription,
          'itinerary.$.geometry': newActivity.geometry,
        },
        $push: {
          'itinerary.$.activities': {
            name: newActivity.name,
            date: newActivity.date,
            phoneNumber: newActivity.phoneNumber, // Duplicating itinerary details
            website: newActivity.website,
            openingHours: newActivity.openingHours,
            photos: newActivity.photos,
            reviews: newActivity.reviews,
            formatted_address: newActivity.formatted_address,
            briefDescription: newActivity.briefDescription,
            geometry: newActivity.geometry,
          },
        },
      },
      {
        new: true, // Return the updated document
      },
    );

    if (!updatedTrip) {
      return res.status(404).json({message: 'Trip or itinerary not found'});
    }

    res
      .status(200)
      .json({message: 'Activity added successfully', trip: updatedTrip});
  } catch (error) {
    console.error('Error in updating itinerary:', error);
    res.status(500).json({message: 'Error in updating itinerary', error});
  }
});

app.get('/trip/:tripId/itinerary', async (req, res) => {
  try {
    const {tripId} = req.params;
    const trip = await Trip.findById(tripId).select('itinerary');
    if (!trip) {
      return res.status(404).json({message: 'trip is not found'});
    }
    res.status(200).json(trip.itinerary);
  } catch (error) {
    console.log('Error in getting itinery ', error);
    res.status(500).json({message: 'Itinternal error intinary getting'});
  }
});

app.delete('/trip/:tripId/itinerary/:date/:activityIndex', async (req, res) => {
  try {
    const {tripId, date, activityIndex} = req.params;

    // Find the trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({message: 'Trip not found'});
    }

    // Find the itinerary for the given date
    const itinerary = trip.itinerary.find(it => it.date === date);
    if (!itinerary) {
      return res
        .status(404)
        .json({message: 'Itinerary not found for this date'});
    }

    // Remove the activity by index
    itinerary.activities.splice(activityIndex, 1);

    // Save updated trip
    await trip.save();

    res.status(200).json({message: 'Activity deleted successfully'});
  } catch (error) {
    console.log('Error deleting activity:', error);
    res.status(500).json({message: 'Internal Server Error'});
  }
});

const JWT_SECRET = crypto.randomBytes(64).toString('hex');
app.post('/google-login', async (req, res) => {
  try {
    const {idToken} = req.body;
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );

    if (!response.data.sub) {
      return res.status(400).send('Invalid Google idToken');
    }

    const {sub, email, name, given_name, family_name, picture} = response.data;
    let user = await User.findOne({googleId: sub});

    if (!user) {
      user = new User({
        googleId: sub,
        email,
        name,
        family_name,
        givenName: given_name,
        photo: picture,
      });
      await user.save();
    }

    const token = jwt.sign({userId: user._id, email: user.email}, JWT_SECRET, {
      expiresIn: '1h',
    });
    res.json({token});
  } catch (error) {
    console.error('Error during Google login:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.put('/setBudget/:tripId', async (req, res) => {
  try {
    console.log(
      'Received Budget Update Request for Trip ID:',
      req.params.tripId,
    );

    const {tripId} = req.params;
    const {budget} = req.body;

    if (!budget) {
      return res.status(400).json({message: 'Budget is required!'});
    }

    const updatedTrip = await Trip.findByIdAndUpdate(
      tripId,
      {$set: {budget: budget}}, // ✅ Only update budget
      {new: true, runValidators: false}, // ✅ Skip full validation
    );

    if (!updatedTrip) {
      return res.status(404).json({message: 'Trip not found!'});
    }

    console.log('✅ Budget updated successfully:', updatedTrip.budget);
    res
      .status(200)
      .json({message: 'Budget updated!', budget: updatedTrip.budget});
  } catch (error) {
    console.error('❌ Error updating budget:', error.message);
    res
      .status(500)
      .json({message: 'Error in updating budget!', error: error.message});
  }
});

app.get('/user/:userId', async (req, res) => {
  try {
    const {userId} = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({message: 'User not found'}); ///------------------------(200)
    }
    return res.status(200).json({user});
  } catch (error) {
    console.log('Error!', error);
    res.status(500).json({message: 'Faild to fetch user'});
  }
});

app.post('/addExpense/:tripId', async (req, res) => {
  try {
    console.log('Received Data:', req.body); // Debugging

    const {tripId} = req.params;
    const {category, price, paidBy, splitBy} = req.body;

    // Validate tripId
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({message: 'Invalid trip ID'});
    }

    // Validate if `paidBy` user exists
    const user = await User.findOne({
      $or: [{name: paidBy}, {googleId: paidBy}],
    });
    if (!user) {
      return res.status(404).json({message: `User '${paidBy}' not found`}); // 🔥 FIXED ERROR
    }

    // Find trip
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({message: 'Trip not found'});
    }

    // Save expense
    const newExpense = {category, price, paidBy, splitBy};
    trip.expenses.push(newExpense);
    await trip.save();

    res.status(200).json({message: 'Expense added successfully', trip});
  } catch (error) {
    console.error('Error!', error);
    res.status(500).json({message: 'Failed to set trip expense'});
  }
});

app.get('/getExpense/:tripId', async (req, res) => {
  try {
    const {tripId} = req.params;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({message: 'Trip is not found'}); ///------------------------(200)
    }

    return res.status(200).json({expenses: trip.expenses});
  } catch (error) {
    console.log('Error!', error);
    res.status(500).json({message: 'Faild to fetch trip expense'});
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shreyasdamase@gmail.com', // Your email address
    pass: 'fwjamctigzytzaou',
  },
});

app.post('/sendInviteEmail', async (req, res) => {
  const {email, tripId, tripName, senderName} = req.body;

  // Construct the email content
  const emailContent = `
    <h3>Hello,</h3>
    <p>${senderName} has invited you to join their trip "<strong>${tripName}</strong>".</p>
    <p>Click the button below to join the trip:</p>
    <a href="http://192.168.0.177:8000/joinTrip?tripId=${tripId}&email=${email}" 
      style="background-color: #4B61D1; color: white; padding: 10px 20px; text-decoration: none; font-size: 16px; border-radius: 5px;">
      Join Trip
    </a>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p>http://192.168.0.177:8000/joinTrip?tripId=${tripId}&email=${email}</p>
    <p>Best regards,</p>
    <p>Wanderlog team</p>
  `;

  // Send email using nodemailer
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Invitation to join the trip: ${tripName}`,
      html: emailContent, // Email content in HTML format
    });

    res.status(200).json({message: 'Invitation email sent successfully'});
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({message: 'Error sending invitation email', error});
  }
});

// Add User to Travelers List
app.get('/joinTrip', async (req, res) => {
  const {tripId, email} = req.query;

  try {
    console.log('trip', tripId);
    console.log('email', email);
    const normalizedEmail = email.toLowerCase();
    // Find the user by email
    const user = await User.findOne({email: normalizedEmail});
    if (!user) {
      return res.status(404).json({message: 'User not found'});
    }

    // Find the trip by tripId
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({message: 'Trip not found'});
    }

    // Check if the user is already in the travelers list
    if (trip.travelers.includes(user._id)) {
      return res.status(400).json({message: 'User is already a traveler'});
    }

    // Add the user to the travelers array
    trip.travelers.push(user._id);
    await trip.save();

    res
      .status(200)
      .json({message: 'You have been successfully added to the trip'});
  } catch (error) {
    res.status(500).json({message: 'Error adding user to trip', error});
  }
});

app.get('/trip/:tripId/note', async (req, res) => {
  try {
    const {tripId} = req.params;
    const trip = await Trip.findById(tripId).select('Notes');
    if (!trip) return res.status(404).json({error: 'Trip not found'});

    res.json({note: trip.Notes});
  } catch (error) {
    res.status(500).json({error: 'Failed to fetch note'});
  }
});

app.put('/trip/:tripId/note', async (req, res) => {
  try {
    const {tripId} = req.params;
    const {note} = req.body;

    const updatedTrip = await Trip.findByIdAndUpdate(
      tripId,
      {Notes: note},
      {new: true},
    );

    if (!updatedTrip) return res.status(404).json({error: 'Trip not found'});

    res.json({note: updatedTrip.Notes});
  } catch (error) {
    res.status(500).json({error: 'Failed to update note'});
  }
});
// Route to delete a user account
app.delete('/user/:userId', async (req, res) => {
  const {userId} = req.params;
  try {
    // Find the user by userId and delete
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({message: 'User not found'});
    }

    res.status(200).json({message: 'User account deleted successfully'});
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({message: 'Error deleting account', error});
  }
});
