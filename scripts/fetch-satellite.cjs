const https = require('https');
const fs = require('fs');
const path = require('path');

// Bounding box around Hotel Estelar La Fontana (Calle 127 con Cra 15)
// lon: -74.0470 to -74.0400, lat: 4.7018 to 4.7072
const minLon = -74.0470;
const minLat = 4.7018;
const maxLon = -74.0400;
const maxLat = 4.7072;

const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&imageSR=4326&size=1024,1024&format=jpg&f=image`;

const dest = path.join(__dirname, '../assets/textures/satellite_ortho_la_fontana.jpg');
const file = fs.createWriteStream(dest);

console.log('Downloading satellite imagery from:', url);

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to download image, status:', res.statusCode);
    return;
  }
  res.pipe(file);
  file.on('finish', () => {
    file.close(() => {
      console.log('Successfully saved satellite imagery to:', dest);
      console.log('File size:', fs.statSync(dest).size, 'bytes');
    });
  });
}).on('error', (err) => {
  console.error('Error downloading:', err.message);
});
