'use strict';

// prettier-ignore
// const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0
  marker

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in minutes
  }

  _setDescription() {
    // Using the Internationalization API (Intl)
    // prettier-ignore
    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${Intl.DateTimeFormat(navigator.language, {month: 'long', day: 'numeric',}).format(this.date)}`;
  }

  click(){
    this.clicks++
  }
}

// RUNNING CLASS
class Running extends Workout {
  type = 'running';
  icon = '🏃‍♂️';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

// CYCLING CLASS
class Cycling extends Workout {
  type = 'cycling';
  icon = '🚴‍♀️';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / this.duration / 60;
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 5.2, 24, 17);

//////////////////////////////
// APPLICATION ARCHITECTURE //
//////////////////////////////
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  // Get position and pass it to _loadMap with coords.
  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position.');
        }
      );
    }
  }

  _loadMap(position) {
    // LATITUDE AND LONGITUDE RECEIVED FROM POSITION OBJECT
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // MAP OBJECT
    this.#map = L.map('map', {
      center: [latitude, longitude],
      zoom: this.#mapZoomLevel,
    });

    if (this.#markers.length > 0)
      this.#map.fitBounds(
        new L.featureGroup(this.#markers).getBounds().pad(0.3)
      );

    // TILES
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    ///// HANDLES CLICKS ON MAP /////
    this.#map.on('click', this._showForm.bind(this));

    // RENDER MARKERS
    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapE) {
    // Handles clicks on map
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  // CREATE NEW WORKOUT AFTER ENTERING
  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(input => Number.isFinite(input));

    const allPositive = (...inputs) => inputs.every(input => input > 0);

    e.preventDefault();

    // Getting coordiantes from map-click event from the _loadMap function
    const { lat: latitude, lng: longitude } = this.#mapEvent.latlng;

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let workout;

    // IF WORKOUT IS RUNNING, CREATE RUNNING OBJECT
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid (guard clause)
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([latitude, longitude], distance, duration, cadence);
    }
    /////////////////////////////////////////////////

    // IF WORKOUT IS CYCLING, CREATE CYCLING OBJECT
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid (guard clause)
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling(
        [latitude, longitude],
        distance,
        duration,
        elevation
      );
    }
    /////////////////////////////////////////////////

    // ADD THE NEW WORKOUT OBJECT TO 'WORKOUTS' ARRAY []
    this.#workouts.push(workout);

    // RENDER WORKOUT AS A MARKER ON MAP
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form and clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(`${workout.icon} ${workout.description}`)
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title"> ${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.icon}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running') {
      html += `          
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>`;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
      </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      `;
    }

    html += `<h3>Location</h3>
            </li>`;
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target;
    // Default clause
    if (workoutEl.closest('.workout') === null) return;
    // prettier-ignore
    const workout = this.#workouts.find(workout => workout.id === workoutEl.closest('.workout').dataset.id )
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });

    // using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    // localStorage.setItem('markers', JSON.stringify(this.#markers));
  }

  // Gets executed when App constructor is called
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    const markers = JSON.parse(localStorage.getItem('markers'));

    if (!data) return;
    if (!markers) this.#markers = [];
    else this.#markers = markers;

    // Transferring data from local storage to workouts array
    this.#workouts = data;

    // Push markers to 'markers' array so I can adjust map to view all markers when map loads.
    this.#workouts.forEach(workout =>
      this.#markers.push(L.marker(workout.coords))
    );

    // Rendering each workout after transferring of data
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
