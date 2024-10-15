# Leaflet and IndexedDB caching map tiles  
This project is a web application that utilizes the [Leaflet.js](https://leafletjs.com/) library for interactive maps and adds functionality for caching map tiles using `IndexedDB`.
## Features

- **Tile Caching**: 
  - Map tiles are cached locally in the browser using `IndexedDB` to allow offline access or to reduce redundant network requests.
  
- **Storage Quota Check**:
  - The app checks the available browser storage quota and issues a warning if more than 85% of the available space is used.
  
- **Network Request Retries**:
  - If a tile request fails, the app automatically retries up to three times with a delay between each attempt.

## How it Works

1. **Leaflet for Map Rendering**: 
   The app uses [Leaflet.js](https://leafletjs.com/) to render an interactive map on the page.

2. **Caching with IndexedDB**:
   - When the map loads, it retrieves map tiles via HTTP requests using the [Axios](https://github.com/axios/axios) library.
   - Each tile is stored in the browser's `IndexedDB` to allow re-use if the tile is requested again, reducing redundant network requests and enabling offline functionality.
   
3. **Storage Management**:
   - The app checks the browser’s storage quota using the `navigator.storage.estimate()` API and logs the current usage. If the usage exceeds 85%, it stops caching additional tiles to avoid exceeding the storage limit.

4. **Retry Mechanism**:
   - The tile fetch function uses a retry mechanism to handle network failures. If a tile fails to load, the app retries the request up to three times with a 1-second delay between attempts.

## Technologies Used

- **Leaflet.js**: A leading open-source library for interactive maps.
- **IndexedDB**: A low-level browser storage API used for caching map tiles.
- **Axios**: A promise-based HTTP client for JavaScript to handle network requests.

## Setup and Installation

To run this project locally, follow the steps below:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/JohnCamelTry/leaflet-cache-tile.git
   cd leaflet-cache-tile
   
2. **Open the project**:

Open index.html in your browser.

3. **Developer Tools**:

To verify that map tiles are being cached correctly, open your browser’s developer tools (press F12).
Navigate to the Applications tab.
Under Storage, expand the IndexedDB section.
Look for the database associated with this project, and you’ll be able to inspect the cached tiles within it.

