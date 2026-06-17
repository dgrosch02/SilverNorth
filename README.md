# SilverNorth

SilverNorth is a real-time object detection and mapping application. It uses a WebRTC/WebSocket Python backend to process video streams through a YOLO model (detecting objects like drones and birds) and broadcasts their estimated GPS coordinates to a React frontend which displays them on a Mapbox map.

## Project Structure

- **`SilverServer/`**: The backend video processing and WebSocket/WebRTC server written in Python.
- **`map-viewer/`**: The React + Vite frontend for displaying the live map and detected targets.

## Prerequisites

- **Python 3.8+** (for the backend server)
- **Node.js 18+** (for the frontend React app)
- A **Mapbox Access Token** (for the map view)

---

## 1. Setup the Backend Server (`SilverServer`)

The backend processes the video streams and detects objects.

### Installation

1. Navigate to the server directory:
   ```bash
   cd SilverServer
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

### Missing YOLO Models?
You mentioned you deleted the YOLO models (`.pt` files). **You don't need to manually download them!** The `ultralytics` package is smart—when you run the server for the first time, it will automatically download `yolov8s-oiv7.pt` and `yolov8x-oiv7.pt` directly into the `SilverServer` directory.

### Running the Server

To start the main WebRTC video processing and WebSocket location server:
```bash
python webRTC-server.py
```
*The server will start on `http://0.0.0.0:3004` and the WebSocket endpoint for locations will be at `ws://localhost:3004/ws/locations`.*

*(Optional)* If you also want to run the REST API server for processing single image uploads:
```bash
python rest-server.py
```

---

## 2. Setup the Frontend (`map-viewer`)

The frontend connects to the backend and maps the detected objects.

### Add Mapbox Token
Before running the frontend, you need to add your Mapbox token:
1. Open `map-viewer/src/App.jsx`.
2. Find line 6 and insert your token:
   ```javascript
   // TODO: Replace with your actual Mapbox access token
   mapboxgl.accessToken = 'pk.YOUR_ACTUAL_TOKEN_HERE';
   ```

### Installation

1. Open a **new terminal window** and navigate to the frontend directory:
   ```bash
   cd map-viewer
   ```
2. Install the Node modules:
   ```bash
   npm install
   ```

### Running the Frontend

Start the Vite development server:
```bash
npm run dev
```
*The app will be available at `http://localhost:5173` (or whichever port Vite provides).*

---

## 3. How to Use

1. Ensure both the **Python Backend** (`webRTC-server.py`) and the **React Frontend** (`map-viewer`) are running simultaneously.
2. Open the React frontend in your browser. You will see a live Mapbox map of New York City (the default location).
3. The frontend connects to the backend via WebSockets. When the backend receives a video stream via WebRTC (from an external client/app), it runs YOLO to identify targets (like Birds, Eagles, Drones) and estimates their GPS coordinates.
4. The coordinates are beamed to the frontend map in real-time, plotting the objects as markers with popups!
