const fs = require('fs');
const JSONStream = require('JSONStream');
const { Transform } = require('stream');

const inputFile = 'enriched_gme_data_latest.json';
const outputFile = 'slim_gme_data_by_city.json';

console.log(`Starting processing of ${inputFile}...`);

const storesByCity = {};
let objectCounter = 0;
const BATCH_SIZE = 1000; // Log progress every BATCH_SIZE objects

// Create a readable stream from the large JSON file
const readStream = fs.createReadStream(inputFile, { encoding: 'utf8' });

// Create a JSONStream parser to handle the array of objects
// '*' means parse every element in the root array
const jsonParser = JSONStream.parse('*');

// Create a transform stream to process each store object
const dataTransformer = new Transform({
  objectMode: true, // Work with JavaScript objects rather than buffers
  transform(store, encoding, callback) {
    objectCounter++;
    if (objectCounter % BATCH_SIZE === 0) {
      console.log(`Processed ${objectCounter} stores...`);
    }

    try {
      // Extract essential information
      const slimStore = {
        place_id: store.place_id || null,
        name: store.name || null,
        address: store.address || null,
        phone: store.phone || null,
        website: store.website || null,
        rating: store.rating !== undefined ? store.rating : null, // Handle rating 0
        featured_image: store.featured_image || null,
        coordinates: store.coordinates || null, // Keep coordinates for potential mapping
      };

      // Extract city from detailed_address, handle potential missing fields
      const city = store.detailed_address?.city;

      if (city) {
        const normalizedCity = city.trim().toUpperCase(); // Normalize city name
        if (!storesByCity[normalizedCity]) {
          storesByCity[normalizedCity] = [];
        }
        storesByCity[normalizedCity].push(slimStore);
      } else {
        // Handle stores without a city - place them in an 'UNKNOWN_CITY' group or log/ignore
        const unknownCityKey = 'UNKNOWN_CITY';
         if (!storesByCity[unknownCityKey]) {
          storesByCity[unknownCityKey] = [];
        }
        storesByCity[unknownCityKey].push(slimStore);
        // console.warn(`Store ${store.place_id || 'N/A'} missing city information.`);
      }

      // Indicate that processing for this chunk is done
      callback();
    } catch (error) {
      console.error(`Error processing store: ${store?.place_id || 'N/A'}`, error);
      // Pass the error downstream or handle it (e.g., skip the object)
      callback(error); // Propagate the error
    }
  }
});

// Pipe the streams together: readFile -> parseJSON -> transformData
readStream.pipe(jsonParser).pipe(dataTransformer);

// Handle errors during streaming
readStream.on('error', (err) => {
  console.error('Error reading input file:', err);
  process.exit(1);
});

jsonParser.on('error', (err) => {
  console.error('Error parsing JSON:', err);
  // This might happen if the JSON is malformed
  process.exit(1);
});

dataTransformer.on('error', (err) => {
  console.error('Error transforming data:', err);
  process.exit(1);
});

// When the transform stream finishes, write the collected data to the output file
dataTransformer.on('finish', () => {
  console.log(`Finished processing ${objectCounter} stores.`);
  console.log(`Writing data grouped by city to ${outputFile}...`);

  try {
    const outputJson = JSON.stringify(storesByCity, null, 2); // Pretty print JSON
    fs.writeFile(outputFile, outputJson, (err) => {
      if (err) {
        console.error('Error writing output file:', err);
        process.exit(1);
      } else {
        console.log(`Successfully created ${outputFile}`);
        // Optional: Log city counts
        const cityCount = Object.keys(storesByCity).length;
        console.log(`Data grouped into ${cityCount} cities (including UNKNOWN_CITY if any).`);
      }
    });
  } catch (error) {
      console.error('Error stringifying final JSON:', error);
      process.exit(1);
  }
});

console.log('Piping streams...');
