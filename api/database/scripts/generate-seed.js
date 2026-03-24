const fs = require('fs');
const path = require('path');

// Read the JSON file
const jsonPath = path.join(__dirname, 'smx.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Helper function to escape SQL strings
function escapeSql(str) {
    if (str === null || str === undefined) return 'NULL';
    return "'" + str.replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

// Helper function to capitalize first letter
function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Track unique songs to avoid duplicates
const songMap = new Map(); // key: "title|artist", value: {id, title, artist}
let songIdCounter = 1;
const chartInserts = [];

// Process each song
data.songs.forEach((song) => {
    const title = song.name;
    const artist = song.artist || '';
    const songKey = `${title}|${artist}`;
    
    // Add song if not already seen
    if (!songMap.has(songKey)) {
        songMap.set(songKey, {
            id: songIdCounter++,
            title: title,
            artist: artist
        });
    }
    
    const songId = songMap.get(songKey).id;
    
    // Process each chart
    if (song.charts && Array.isArray(song.charts)) {
        song.charts.forEach((chart) => {
            const difficulty = chart.lvl;
            let mode = chart.diffClass || '';
            
            // Capitalize first letter of mode
            mode = capitalize(mode);
            
            // Check if flags contains "plus"
            if (chart.flags && Array.isArray(chart.flags) && chart.flags.includes('plus')) {
                mode = mode + '+';
            }
            
            chartInserts.push({
                song_id: songId,
                difficulty: difficulty,
                mode: mode
            });
        });
    }
});

// Generate SQL
let sql = '-- MySQL seed script for song and song_x_chart tables\n';
sql += '-- Generated from smx.json\n\n';

// Generate INSERT statements for songs
sql += '-- Insert songs\n';
sql += 'INSERT INTO `song` (`title`, `artist`) VALUES\n';
const songValues = Array.from(songMap.values()).map(song => {
    return `(${escapeSql(song.title)}, ${escapeSql(song.artist)})`;
});
sql += songValues.join(',\n') + ';\n\n';

// Generate INSERT statements for song_x_chart
sql += '-- Insert song charts\n';
sql += 'INSERT INTO `song_x_chart` (`song_id`, `difficulty`, `mode`) VALUES\n';
const chartValues = chartInserts.map(chart => {
    return `(${chart.song_id}, ${chart.difficulty}, ${escapeSql(chart.mode)})`;
});
sql += chartValues.join(',\n') + ';\n';

// Write to file
const outputPath = path.join(__dirname, 'seed-songs.sql');
fs.writeFileSync(outputPath, sql, 'utf8');

console.log(`Generated seed script: ${outputPath}`);
console.log(`Songs: ${songMap.size}`);
console.log(`Charts: ${chartInserts.length}`);

