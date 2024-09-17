const Apartment = require("../models/apartment.model.js");
const Reservation = require("../models/reservation.model.js");
const { getDateRange } = require("../utils/dateUtils.js");

// Render dashboard and get reservations made by standard user, and get apartments owned by host as well of bookings of said apartments
const getDashboard = async (req, res) => {
  try {
    if (res.locals.isAuthenticated) {

      // Helper function to format dates
      function formatDate(dateString) {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      }
      
      // Get list of all reservations - made by specific standard user
      const reservations = await Reservation.find({ user: userData.id })
        .populate({
          path: "apartment",
          populate: {
            path: "user", // Populate the user field inside the apartment
            select: "name email", // Select which fields to include from the user schema
          },
        })
        .sort({ startDate: -1 }) // Sort by startDate in descending order
        .exec();

      // Format dates of reservations
      reservations.forEach((reservation) => {
        reservation.startDateFormatted = formatDate(reservation.startDate);
        reservation.endDateFormatted = formatDate(reservation.endDate);
      });

      const sortByValue = req.query.sortByBookings

      let sortByQuery 
      if (sortByValue == "startDate"){
        sortByQuery = {startDate: 1}
      } else if (sortByValue === "endDate") {
        sortByQuery = {endDate: 1}
      } else if (sortByValue === "startDateLast"){
        sortByQuery = {startDate: -1}
      } else if (sortByValue === "endDateLast") {
        sortByQuery = {endDate: -1}
      } else if (sortByValue === "usernameAz") {
        sortByQuery = {user: 1}
      } else if (sortByValue === "usernameZa") {
        sortByQuery = {user: -1}
      } else if (sortByValue === "titleAz") {
        sortByQuery = {apartment: 1}
      } else if (sortByValue === "titleZa") {
        sortByQuery = {apartment: -1}
      }

      // Get list of all reservations and populate the user object
      const allApartmentsBooked = await Reservation.find()
        .populate("apartment")
        .populate("user")
        .sort(sortByQuery)
        .exec();

      // Filter reservations by admin user id so that an admin only sees their apartment reservations
      const myApartmentsBooked = allApartmentsBooked.filter(
        (ap) => ap.apartment.user._id.toString() === userData.id
      );

      // Format dates of apartments booked
      myApartmentsBooked.forEach((reservation) => {
        reservation.startDateFormatted = formatDate(reservation.startDate);
        reservation.endDateFormatted = formatDate(reservation.endDate);
      });

      const sortByValueApartments = req.query.sortByApartments
      console.log(sortByValueApartments)


      let sortByQueryApartments 
      if (sortByValueApartments == "newest"){
        sortByQueryApartments = {createdAt: 1}
      } else if (sortByValueApartments == "oldest"){
        sortByQueryApartments = {createdAt: -1}
      } else if (sortByValueApartments == "listed"){
        sortByQueryApartments = {listed: -1}
      } else if (sortByValueApartments == "delisted"){
        sortByQueryApartments = {listed: 1}
      } else if (sortByValueApartments == "titleAzApartments"){
        sortByQueryApartments = {title: 1}
      } else if (sortByValueApartments == "titleZaApartments"){
        sortByQueryApartments = {title: -1}
      } else if (sortByValueApartments == "priceHigh"){
        sortByQueryApartments = {price: -1}
      } else if (sortByValueApartments == "priceLow"){
        sortByQueryApartments = {price: 1}
      }


      // Get list of all apartments owned by admin user using their user id
      const apartments = await Apartment.find({ user: userData.id }).sort(
        sortByQueryApartments 
      );

      console.log("apartments: ", apartments[0])

      res.render("dashboard", { reservations, apartments, myApartmentsBooked });
    } else {
      res
        .status(404)
        .render("404", { message: "You must log in to see your dashboard." });
    }
  } catch (error) {
  }
};

// Render reservation.ejs with success message and further call to action buttons
const getReservation = async (req, res) => {
  try {
    if (res.locals.isAuthenticated && res.locals.isUser) {
      res.render("reservation");
    } else {
      res.status(404).render("404", {
        message: "You must log in before making a reservation.",
      });
    }
  } catch (error) {
    console.error("Error fetching reservation confirmation:", error);
    res.status(500).json({ error: "Failed to fetch reservation confirmation" });
  }
};

// Get all listed properties to show on opening home page
const getApartments = async (req, res) => {
  try {
    // Find all apartments in the database that have been listed by their respective hosts (admin users)
    const apartments = await Apartment.find({ listed: true }).sort({
      createdAt: -1,
    });

    if (apartments.length == 0) {
      res.render("home", { apartments, zeroResultsMessage: true });
    } else {
      res.render("home", { apartments, zeroResultsMessage: false });
    }
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch apartments" });
  }
};

// Get a specific property by ID, and get its reserved dates
const getApartmentById = async (req, res) => {
  try {
    const { idApartment } = req.params;
    // Find the apartment
    const selectedApartment = await Apartment.findById(idApartment).populate("user");
    // Find all reservations of that apartment
    const reservations = await Reservation.find({ apartment: idApartment });

    // Find all reserved dates of all reservations of the specific apartment
    const reservedDates = reservations.reduce((acc, reservation) => {
      const { startDate, endDate } = reservation;
      const range = getDateRange(new Date(startDate), new Date(endDate));
      return acc.concat(range);
    }, []);

    console.log(selectedApartment.user.username)

    res.render("apartment-details", {
      selectedApartment,
      reservedDates,
    });
  } catch (error) {
    console.error("Error fetching apartment details:", error);
    res.status(500).json({ error: "Failed to fetch apartment details" });
  }
};

// Search for properties based on filters
const searchApartments = async (req, res) => {
  let {
    maxPrice,
    minPrice,
    numberOfGuests,
    location,
    startDate,
    endDate,
    sortBy,
  } = req.query;

  // set default values if and when no value is given by the user in the input of the HTML form
  const searchQuery = {
    price: {
      $gte: minPrice || "0",
      $lte: maxPrice || "10000",
    },
    maxNumberOfGuests: {
      $gte: numberOfGuests || "1",
    },
  };

  if (location) {
    searchQuery.city = location;
  }

  try {
    let reservedApartmentIds = [];

    // Check if startDate and endDate are provided
    if (startDate && endDate) {
      // Convert the startDate and endDate to JavaScript Date objects
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Find all reservations that overlap with the given date range
      const reservations = await Reservation.find({
        $or: [
          {
            startDate: { $lte: end }, // Reservation starts before or on the search end date
            endDate: { $gte: start }, // Reservation ends after or on the search start date
          },
        ],
      }).select("apartment");

      // Get the apartment IDs that are reserved in the given range
      reservedApartmentIds = reservations.map(
        (reservation) => reservation.apartment
      );
    }

    // Add condition to exclude reserved apartments if there are any
    if (reservedApartmentIds.length > 0) {
      searchQuery._id = { $nin: reservedApartmentIds }; // Exclude reserved apartments
    }

    let sortByInputValue;

    if (sortBy == "mostRecent") {
      sortByInputValue = { createdAt: -1 };
    } else if (sortBy == "minPriceFirst") {
      sortByInputValue = { price: 1 };
    } else if (sortBy == "maxPriceFirst") {
      sortByInputValue = { price: -1 };
    }

    // Filter apartments based on search query
    const apartments = await Apartment.find({
      ...searchQuery,
      listed: true,
    }).sort(sortByInputValue);

    if (apartments.length == 0) {
      const defaultApartments = await Apartment.find({ listed: true })
        .limit(5)
        .sort({ createdAt: -1 }); // Fetch 5 default properties if filter gives zero results
      return res.render("home", {
        apartments: defaultApartments,
        zeroResultsMessage: true,
      });
    }

    res.render("home", { apartments, zeroResultsMessage: false });
  } catch (error) {
    console.error("Error during property search:", error);
    res.status(500).json({ error: "Failed to search for properties" });
  }
};

// Post a new reservation for a specific apartment
const postNewReservation = async (req, res) => {
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);

  if (isNaN(startDate) || isNaN(endDate)) {
    return res.status(400).json({ error: "Invalid dates provided." });
  }

  try {
    // Get all reservations for the specific apartment using the apartment's id
    const reservations = await Reservation.find({ apartment: req.body.id });

    // Create an array of all reserved dates
    const reservedDates = reservations.reduce((acc, reservation) => {
      const { startDate, endDate } = reservation;
      const range = getDateRange(new Date(startDate), new Date(endDate));
      return acc.concat(range);
    }, []);

    // Get the range of dates for the new reservation
    const dateRangeForNewReservation = getDateRange(startDate, endDate);

    // Check if any of the new reservation dates overlap with existing booking dates
    const hasOverlap = dateRangeForNewReservation.some((date) =>
      reservedDates.some(
        (reservedDate) => date.getTime() === reservedDate.getTime()
      )
    );

    // Send error message if there are overlapping dates
    if (hasOverlap) {
      req.flash("error", "The requested dates are not available.");
      return res.redirect(`/apartment/${req.body.id}`);
    }

    // Ensure the start date is before the end date
    if (startDate < endDate) {
      await Reservation.create({
        email: req.body.email,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        apartment: req.body.id,
        user: userData.id,
      });

      res.redirect("/reservation");
    } else {
      req.flash("error", "Invalid date range, please try again.");
      res.status(400).redirect(`/apartment/${req.body.id}`);
    }
  } catch (error) {
    console.error("Error posting reservation:", error);
    res.status(500).json({ error: "Failed to create reservation" });
  }
};

module.exports = {
  getDashboard,
  getReservation,
  getApartments,
  getApartmentById,
  searchApartments,
  postNewReservation,
};
